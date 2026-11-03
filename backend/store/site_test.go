package store

import (
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// 官网埋点数据层单测（看板补齐批 2026-11-03；口径锚点=净屏 site.go 同名拍板）：
// IsBotUA 三段规则/SanitizeChannel 白名单/SiteStats 双口径+站长剔除/DownloadStats
// 去重/BuyClickStats 拆分/突发指纹回扫与站长豁免/VisitDetail 时间窗与明细三区块。

const (
	uaChrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
	uaBot    = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

func TestIsBotUA(t *testing.T) {
	bots := []string{
		"",
		"curl/8.4.0",
		"python-requests/2.31",
		uaBot,
		"Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0",
		// 残缺 UA（Mozilla/5.0 开头但无任何真实浏览器 token）→ bot（净屏 10-08 实证口径）
		"Mozilla/5.0",
	}
	for _, ua := range bots {
		if !IsBotUA(ua) {
			t.Fatalf("应判 bot: %q", ua)
		}
	}
	humans := []string{
		uaChrome,
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (Version/17.0 Mobile/15E148 Safari/604.1)",
		"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0",
		// 非 Mozilla 系且未命中黑名单 → 不做残缺判定（脚本类才在黑名单）
		"MyCustomAgent/1.0",
	}
	for _, ua := range humans {
		if IsBotUA(ua) {
			t.Fatalf("应判真人: %q", ua)
		}
	}
	// okhttp/go-http-client 类脚本库恒在黑名单（独立断言，防外层语义反转连带漏检）
	if !IsBotUA("okhttp/4.9.0") {
		t.Fatal("okhttp 应命中黑名单判 bot")
	}
}

func TestSanitizeChannel(t *testing.T) {
	if SanitizeChannel("xianyu_ad-2") != "xianyu_ad-2" {
		t.Fatal("白名单内应原样通过")
	}
	for _, bad := range []string{"", strings.Repeat("a", 33), "百度!", "UPPER"} {
		if got := SanitizeChannel(bad); got != "" {
			t.Fatalf("应归一空串: %q → %q", bad, got)
		}
	}
}

func TestSiteStatsDualScopeAndOwnerExclude(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "site-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	// 真人：vid-A 2 PV；站长 vid-B 1 PV；爬虫 vid-C 1 PV（bot 行不触发指纹回扫）
	if err := st.RecordSiteVisit("vid-A", "/", "1.2.3.4", uaChrome, "", ""); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordSiteVisit("vid-A", "/download", "1.2.3.4", uaChrome, "https://ref.example", "ad1"); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordSiteVisit("vid-B", "/", "1.2.3.5", uaChrome, "", ""); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordSiteVisit("vid-C", "/", "1.2.3.6", uaBot, "", ""); err != nil {
		t.Fatal(err)
	}
	// 无站长名单：Human=非 bot 全量（3 PV/2 UV），Raw 相同
	d, err := st.SiteStats()
	if err != nil {
		t.Fatal(err)
	}
	if d.PvTodayHuman != 3 || d.UvTodayHuman != 2 || d.PvTodayRaw != 4 || d.UvTodayRaw != 3 {
		t.Fatalf("无名单口径不符: %+v", d)
	}
	// 配置站长名单：B 剔出真人口径，Raw 恒全量
	if err := st.SettingSet("site_owner_vids", "vid-B"); err != nil {
		t.Fatal(err)
	}
	d, err = st.SiteStats()
	if err != nil {
		t.Fatal(err)
	}
	if d.PvTodayHuman != 2 || d.UvTodayHuman != 1 {
		t.Fatalf("站长剔除后真人口径应 2PV/1UV: %+v", d)
	}
	if d.PvTodayRaw != 4 || d.UvTodayRaw != 3 {
		t.Fatalf("Raw 应恒全量: %+v", d)
	}
}

func TestDownloadAndBuyClickStats(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "site-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.RecordDownload("vid-D"); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordDownload("vid-D"); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordDownload("vid-E"); err != nil {
		t.Fatal(err)
	}
	clicks, unique, err := st.DownloadStats("today")
	if err != nil || clicks != 3 || unique != 2 {
		t.Fatalf("下载统计应 3 次/2 人: %d/%d %v", clicks, unique, err)
	}
	if _, _, err := st.DownloadStats("all"); err != nil {
		t.Fatal(err)
	}
	// BuyClickStats：xianyu/shop 拆分（拾音现仅 xianyu 上报，shop 列保留同构查询）
	if err := st.RecordBuyClick("xianyu", "vid-D", "scheme", "app"); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordBuyClick("xianyu", "vid-E", "legacy", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := st.db.Exec(`INSERT INTO site_buy_clicks(kind,visitor_id,at,result,source) VALUES('shop','vid-F',?,'fallback','web')`, time.Now().Unix()); err != nil {
		t.Fatal(err)
	}
	xy, shop, err := st.BuyClickStats("today")
	if err != nil || xy != 2 || shop != 1 {
		t.Fatalf("购买点击应 闲鱼2/小店1: %d/%d %v", xy, shop, err)
	}
}

func TestBurstBatchMarkAndOwnerExempt(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "site-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	// 同 C 段 5 个访客各恰 1 PV（阈值 4）→ 批量标 bot；站长 vid 豁免
	if err := st.SettingSet("site_owner_vids", "vid-O"); err != nil {
		t.Fatal(err)
	}
	vids := []string{"vid-O", "vid-1", "vid-2", "vid-3", "vid-4"}
	for i, v := range vids {
		if err := st.RecordSiteVisit(v, "/", "9.9.9."+strconv.Itoa(i+1), uaChrome, "", ""); err != nil {
			t.Fatal(err)
		}
	}
	// 触发者 vid-5（同段第 6 个访客）入库即回扫
	if err := st.RecordSiteVisit("vid-5", "/faq", "9.9.9.6", uaChrome, "", ""); err != nil {
		t.Fatal(err)
	}
	var botO, bot1 int
	if err := st.db.QueryRow(`SELECT COALESCE(is_bot,-1) FROM site_visits WHERE visitor_id='vid-O'`).Scan(&botO); err != nil {
		t.Fatal(err)
	}
	if err := st.db.QueryRow(`SELECT COALESCE(is_bot,-1) FROM site_visits WHERE visitor_id='vid-1'`).Scan(&bot1); err != nil {
		t.Fatal(err)
	}
	if botO != 0 {
		t.Fatalf("站长豁免不应被标 bot: is_bot=%d", botO)
	}
	if bot1 != 1 {
		t.Fatalf("批量访客应被回扫标 bot: is_bot=%d", bot1)
	}
}

func TestVisitDetailWindowsAndBlocks(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "site-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.RecordSiteVisit("vid-A", "/", "1.2.3.4", uaChrome, "", ""); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordSiteVisit("vid-A", "/download", "1.2.3.4", uaChrome, "https://out.example/x", "ad1"); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordSiteVisit("vid-C", "/", "1.2.3.6", uaBot, "", ""); err != nil {
		t.Fatal(err)
	}
	// 旧窗行：at 回拨 8 天 → 不在 today、在 all
	if _, e := st.db.Exec(`UPDATE site_visits SET at=? WHERE page='/download'`, time.Now().Unix()-8*86400); e != nil {
		t.Fatal(e)
	}

	// visit_today（w 空→按 metric 自带口径）：聚合表=首页 1 行（爬虫行不进聚合），
	// 旧窗 /download 不在窗内
	d, err := st.VisitDetail("visit_today", "")
	if err != nil {
		t.Fatal(err)
	}
	if d.Title != "今日浏览·真人(PV/UV)" || len(d.Rows) != 1 || d.Rows[0][0] != "首页" {
		t.Fatalf("today 明细不符: %s %+v", d.Title, d.Rows)
	}
	if d.Extra == nil || len(d.Extra.Rows) == 0 {
		t.Fatal("Extra 打开环境分布应非空")
	}
	if d.More == nil || len(d.More.Rows) != 2 {
		t.Fatalf("More 访客明细应含真人+爬虫两访客: %+v", d.More)
	}
	// 类型列三态：爬虫/真人（站长未配置不出现「本人」）；行序=最近浏览倒序，
	// vid-A 的 /download 行已回拨 8 天 → vid-C 排首
	if d.More.Rows[0][0] != "vid-C" || d.More.Rows[0][1] != "爬虫" {
		t.Fatalf("vid-C 应标爬虫排首: %+v", d.More.Rows[0])
	}
	if d.More.Rows[1][0] != "vid-A" || d.More.Rows[1][1] != "真人" {
		t.Fatalf("vid-A 应标真人: %+v", d.More.Rows[1])
	}

	// visit_total（w 空→all）：旧窗行回归，/download 页名映射
	dAll, err := st.VisitDetail("visit_total", "")
	if err != nil {
		t.Fatal(err)
	}
	if dAll.Title != "累计浏览·真人(PV/UV)" || len(dAll.Rows) != 2 {
		t.Fatalf("all 明细应 2 页面行: %s %+v", dAll.Title, dAll.Rows)
	}
	// 显式未知窗报错（与净屏同款 fail-fast）
	if _, err := st.VisitDetail("visit_today", "bogus"); err == nil {
		t.Fatal("未知窗应报错")
	}
}

func TestDownloadAndBuyClickDetail(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "site-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.RecordDownload("vid-D"); err != nil {
		t.Fatal(err)
	}
	dd, err := st.DownloadDetail()
	if err != nil || len(dd.Rows) != 1 || dd.Cols[0] != "访客" {
		t.Fatalf("下载明细形状不符: %+v %v", dd, err)
	}
	if err := st.RecordBuyClick("xianyu", "vid-D", "scheme", "app"); err != nil {
		t.Fatal(err)
	}
	bd, err := st.BuyClickDetail("", "")
	if err != nil || len(bd.Rows) != 1 {
		t.Fatalf("购买明细形状不符: %+v %v", bd, err)
	}
	// 结果列中文映射 + 拾音来源注记（S-9）
	if bd.Rows[0][2] != "拉起成功" {
		t.Fatalf("scheme 应映射「拉起成功」: %+v", bd.Rows[0])
	}
	if !strings.Contains(bd.Title, "来源恒 App 端") {
		t.Fatalf("title 应带来源注记: %s", bd.Title)
	}
}

// site.go 官网埋点数据层（看板补齐批 2026-11-03，净屏 tomato-ad-skip
// backend/store/site.go+dashboard.go 拾音适用子集同构搬运——双源锚点见
// admin/panel.go 头注释漂移防线；口径全部沿用净屏既有拍板，本文件无新自定项）：
// 浏览 PV/UV（真人/原始双口径+站长剔除+三道反爬）/下载点击/购买点击聚合，
// 及看板明细三件（VisitDetail/DownloadDetail/BuyClickDetail）。
// 时区与窗口工具复用 ordercore 单源（osv.Today0CST/CSTZone/FmtTimeCST/
// SalesWindowFrom/SalesWindowLabel），不另立本地副本。
package store

import (
	"fmt"
	"log"
	"net"
	"sort"
	"strconv"
	"strings"
	"time"

	osv "ordercore/orderstore"
)

// IsBotUA 判定官网访问 UA 是否非真人浏览器流量。尽力而为的统计口径标记，
// 非反作弊边界（UA 可伪造）；黑名单迭代不回溯历史行（ua 原文已留存，必要时
// 一次性 SQL 重算）。三段规则（净屏 site.go 同文，拍板记录随注释）：
//  1. 空 UA → bot（真人浏览器必有 UA）。
//  2. 显式爬虫/脚本/无头/自家工具 token → bot（业界通行黑名单，对标 GA4
//     IAB list 与 Matomo DeviceDetector 的 bot 签名思路；IP/频率维度第一版
//     不做——本产品自定，YAGNI）。
//  3. 残缺 UA 判定（"Mozilla/5.0" 开头但不含任何已知真实浏览器 token）→ bot
//     ——无业界先例（Matomo/GA4 对 unknown UA 一律不剔），本产品自定：依据
//     净屏 2026-10-08 生产日志实证（残缺 Mozilla 批量请求均为采集器），适用面
//     仅限 Mozilla 开头 UA，勿扩大。
// IP/频率维度原「第一版不做」（YAGNI）已被净屏 2026-10-16 拍板推翻：伪造完整
// Chrome UA 的采集器（10-08/10-16 两批同源 C 段实证）整批漏过 UA 判定，写入时
// 补 IP 前缀黑名单 + C 段批量突发指纹两道（ipPrefixBlocked / markBurstBatch）。
func IsBotUA(ua string) bool {
	if ua == "" {
		return true
	}
	lower := strings.ToLower(ua)
	// 全部为 UA 真实 token 的小写形式；"crawl" 已覆盖 crawler/crawlerd。
	botTokens := []string{
		"bot", "crawler", "spider", "crawl",
		"curl/", "wget", "python-requests", "python-urllib", "scrapy",
		"go-http-client", "apache-httpclient", "java/", "okhttp", "dalvik",
		"headlesschrome", "phantomjs", "puppeteer", "playwright",
		"zcode", // 自家 CLI 工具
	}
	for _, t := range botTokens {
		if strings.Contains(lower, t) {
			return true
		}
	}
	if !strings.HasPrefix(lower, "mozilla/5.0") {
		return false // 非 Mozilla 系 UA 不做残缺判定（脚本类已在黑名单命中）
	}
	// 真实浏览器 UA 必含其一：Chrome/Safari/Firefox/Edge/IE/Opera、微信/QQ 内置、
	// 国产浏览器（token 全为 UA 真实写法的小写）、iOS WKWebView 兜底（其 UA 可无
	// Safari 标识但必有 iPhone/iPad）。漏判新浏览器=多算访客可接受，误判真人才伤。
	browserTokens := []string{
		"chrome", "safari", "firefox", "edg", "msie", "trident", "opera",
		"micromessenger", "mqqbrowser", "ucbrowser", "quark",
		"huaweibrowser", "samsungbrowser", "miuibrowser", "heytapbrowser",
		"vivobrowser", "oppobrowser", "oneplusbrowser", "baidubrowser",
		"baiduboxapp", "sogoumobilebrowser", "liebaobrowser", "newsarticle",
		"iphone", "ipad",
	}
	for _, t := range browserTokens {
		if strings.Contains(lower, t) {
			return false
		}
	}
	return true
}

// truncateUA UA 入库截断（IsBotUA 判定已用原始 UA 完成，截断仅限存储）。
func truncateUA(ua string) string {
	if len(ua) > 512 {
		return ua[:512]
	}
	return ua
}

// truncateRef 来源页入库截断（document.referrer 可带完整路径与长查询串）。
func truncateRef(ref string) string {
	if len(ref) > 300 {
		return ref[:300]
	}
	return ref
}

// SiteEnv 浏览打开环境分类（净屏 2026-10-12 浏览来源能力②同文）：UA 原文已
// 全量入库，统计端重算即得——零采集改动。对标 Matomo DeviceDetector 的客户端
// 识别思路；App 内嵌 UA 普遍同时含通用浏览器 token（如抖音内嵌含 Chrome），
// 必须先判 App 专属 token 再落通用浏览器桶。返回中文环境名（看板明细直显）；
// 空 UA=未知（存量行），未识别=其他。
func SiteEnv(ua string) string {
	if strings.TrimSpace(ua) == "" {
		return "未知"
	}
	lower := strings.ToLower(ua)
	for _, e := range []struct{ token, name string }{
		{"micromessenger", "微信"},
		{"mqqbrowser", "QQ"},
		{"aweme", "抖音"},
		{"kswebview", "快手"},
		{"newsarticle", "头条"},
		{"weibo", "微博"},
		{"baiduboxapp", "百度App"},
		{"baidubrowser", "百度"},
		{"ucbrowser", "UC"},
		{"quark", "夸克"},
		{"huaweibrowser", "华为"},
		{"miuibrowser", "小米"},
		{"vivobrowser", "vivo"},
		{"oppobrowser", "OPPO"},
		{"heytapbrowser", "一加"},
		{"oneplusbrowser", "一加"},
		{"samsungbrowser", "三星"},
		{"sogoumobilebrowser", "搜狗"},
		{"liebaobrowser", "猎豹"},
	} {
		if strings.Contains(lower, e.token) {
			return e.name
		}
	}
	switch {
	case strings.Contains(lower, "edg"), strings.Contains(lower, "msie"), strings.Contains(lower, "trident"):
		return "Edge/IE"
	case strings.Contains(lower, "firefox"):
		return "Firefox"
	case strings.Contains(lower, "opera"), strings.Contains(lower, "opr/"):
		return "Opera"
	case strings.Contains(lower, "iphone"), strings.Contains(lower, "ipad"):
		if strings.Contains(lower, "safari") {
			return "Safari"
		}
		return "App内嵌" // iOS WKWebView 兜底（无 Safari 标识的第三方壳）
	case strings.Contains(lower, "chrome"), strings.Contains(lower, "crios"):
		return "Chrome"
	case strings.Contains(lower, "safari"):
		return "Safari"
	}
	return "其他"
}

// refSource 来源页展示值（净屏能力③同文）：空=直接打开（地址栏粘贴/扫码零
// referrer）；http(s) 形态提取主机名（referrer 常带完整路径与查询串，明细列
// 只留域，跨行可聚合可读）；非 URL 形态原样展示（截 60）。
func refSource(ref string) string {
	if ref == "" {
		return "直接打开"
	}
	if i := strings.Index(ref, "://"); i > 0 {
		rest := ref[i+3:]
		if j := strings.IndexAny(rest, "/?#"); j >= 0 {
			rest = rest[:j]
		}
		if rest != "" {
			return rest
		}
	}
	if len(ref) > 60 {
		return ref[:60]
	}
	return ref
}

// RecordSiteVisit 记录一次网站页面浏览（PV）。visitor_id 为浏览器 localStorage
// 随机 id；空 id 忽略（隐私/无效上报）。page 为路径（如 '/'、'/download'）。
// ua 为原始 User-Agent：is_bot 判定用原文，入库截断。referer 为官网页面上报的
// document.referrer：空=地址栏直接打开，非空=站外页面跳转（展示层提取主机名，
// refSource）。channel 为渠道标记：客户端首触持久化的 ?from= 值，SanitizeChannel
// 白名单校验后入库。
func (s *Store) RecordSiteVisit(vid, page, ip, ua, referer, channel string) error {
	if vid == "" {
		return nil
	}
	bot := 0
	if IsBotUA(ua) {
		bot = 1
	}
	// 双层自动标记（净屏 2026-10-16 拍板）：UA 判定之外补 IP 维度——前缀黑名单
	// 入库前定 bot；突发指纹在入库后回扫（需见到本行后的窗口全貌）。
	if bot == 0 && s.ipPrefixBlocked(ip) {
		bot = 1
	}
	if _, err := s.db.Exec(`INSERT INTO site_visits(visitor_id,page,ip,at,ua,is_bot,referer,channel) VALUES(?,?,?,?,?,?,?,?)`,
		vid, page, ip, time.Now().Unix(), truncateUA(ua), bot, truncateRef(referer), SanitizeChannel(channel)); err != nil {
		return err
	}
	if bot == 0 {
		// 尽力而为：指纹回扫失败不拦入库，下次同段访问重触发
		s.markBurstBatch(ip)
	}
	return nil
}

// ipPrefixBlocked 爬虫 IP 前缀黑名单（meta site_bot_ip_prefixes，逗号分隔前缀如
// "123.6.49.,27.115.124."）。双层标记之①，对标 Umami IGNORE_IP 的已知段排除；
// 本产品手工名单制=实证驱动量级下的自定选择（净屏同款）。键缺省/名单空=未启用。
func (s *Store) ipPrefixBlocked(ip string) bool {
	for _, p := range splitCSVSetting(s.Setting("site_bot_ip_prefixes")) {
		if strings.HasPrefix(ip, p) {
			return true
		}
	}
	return false
}

// markBurstBatch C 段批量突发指纹（净屏 2026-10-16 拍板双层标记之②，同文搬运）：
// 同 /24 IPv4 段 10 分钟窗内 ≥N 个不同访客且各恰 1 PV → 全部回填 is_bot=1。
// 指纹取自净屏 10-08/10-16 两批生产实证（每 vid 恰 1 PV、同 C 段分钟级批量、
// 页面散布合规页）；误伤需 N 个同段真人在窗内同时到访且各自仅 1 PV——日真人
// UV 个位数量级下≈0。同窗内 ≥2 PV 的访客（真人连续浏览特征）不扫。口径注记：
// 「恰 1 PV」为窗内行数（HAVING COUNT(*)=1），非历史全量口径；层间联动——已被
// UA 层/黑名单标 bot 的行不进回扫计数（is_bot=0 限定），混合流量的漏网行由下次
// 同段访问重触发兜底。运行时旋钮：meta 键 site_burst_min_vids，0=停用，非法/
// 缺省=4；与黑名单「清空即停」对称。站长 vid 豁免：家人设备同段同窗不因站长
// 到访被整批误标。仅 IPv4（现存爬虫流量即 IPv4，IPv6 待实证再扩）；无业界
// 先例，本产品自定。
func (s *Store) markBurstBatch(ip string) {
	t4 := net.ParseIP(strings.TrimSpace(ip)).To4()
	if t4 == nil {
		return
	}
	raw := strings.TrimSpace(s.Setting("site_burst_min_vids"))
	if raw == "0" {
		return
	}
	minVids := burstBatchMinVids
	if n, e := strconv.Atoi(raw); e == nil && n > 0 {
		minVids = n
	}
	// 前缀由 To4 字节构造（净屏审查根修同款）：校验即所用，入参空白与
	// IPv4-mapped 形式（::ffff:a.b.c.d）统一归到纯 IPv4 文本。查询走 at 索引窗扫。
	prefix := fmt.Sprintf("%d.%d.%d.%%", t4[0], t4[1], t4[2])
	ownerSet := map[string]bool{}
	for _, v := range s.OwnerVids() {
		ownerSet[v] = true
	}
	// 单次取时基：SELECT 与 UPDATE 同窗，无毫秒级漂移
	cutoff := time.Now().Unix() - 600
	vids := []string{}
	rows, err := s.db.Query(`SELECT visitor_id FROM site_visits
		WHERE ip LIKE ? AND at>=? AND is_bot=0
		GROUP BY visitor_id HAVING COUNT(*)=1`, prefix, cutoff)
	if err != nil {
		// 尽力而为路径的可观测出口：静默失效曾致净屏本批事故隔日才发现，留日志防再犯
		log.Printf("[SITE] burst scan query failed (ip=%s): %v", ip, err)
		return
	}
	for rows.Next() {
		var v string
		if rows.Scan(&v) == nil && !ownerSet[v] {
			vids = append(vids, v)
		}
	}
	rows.Close()
	if rows.Err() != nil {
		log.Printf("[SITE] burst scan iterate failed (ip=%s): %v", ip, rows.Err())
		return
	}
	if len(vids) < minVids {
		return
	}
	args := make([]any, 0, len(vids)+2)
	q := `UPDATE site_visits SET is_bot=1 WHERE ip LIKE ? AND at>=? AND is_bot=0 AND visitor_id IN (`
	args = append(args, prefix, cutoff)
	for i, v := range vids {
		if i > 0 {
			q += ","
		}
		q += "?"
		args = append(args, v)
	}
	if _, err := s.db.Exec(q+")", args...); err != nil {
		log.Printf("[SITE] burst mark failed (%d vids): %v", len(vids), err)
	}
}

// burstBatchMinVids 突发指纹的访客数缺省阈值（含当前访问；4=净屏两批实证批量
// 的下限；meta site_burst_min_vids 可调，0=停用）。
const burstBatchMinVids = 4

// SanitizeChannel 渠道标记白名单（净屏迁移 007 同款）：[a-z0-9_-]{1,32}，不符
// 返回空串（客户端已首触持久化并预校验，服务端再拦防自由串入库）。
func SanitizeChannel(ch string) string {
	if len(ch) == 0 || len(ch) > 32 {
		return ""
	}
	for i := 0; i < len(ch); i++ {
		c := ch[i]
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return ""
		}
	}
	return ch
}

// splitCSVSetting meta 逗号分隔键解析（trim 空段，空键=空名单）。
func splitCSVSetting(v string) []string {
	out := []string{}
	for _, p := range strings.Split(v, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// OwnerVids 站长自测访客名单（meta site_owner_vids，逗号分隔 vid）。净屏
// 2026-10-16 拍板同款：真人聚合口径剔除 + 访客明细标「本人」——站长自测不算
// 外部访客。名单空=不剔除（label 不提「与站长」，联动规则见 panel 卡面）。
// 业界对标（净屏审查补引）：与 Plausible/Umami 的 localStorage 标志排除自访
// 同型；vid 持久标识不随手机网络 IP 漂移，较纯 IP 排除更稳。配置面=手写 meta
// 键（净屏同款运营惯例，无 UI 入口）。
func (s *Store) OwnerVids() []string {
	return splitCSVSetting(s.Setting("site_owner_vids"))
}

// ownerExcludeSQL 真人聚合口径的站长剔除子句（名单空=零开销空路径）。
func ownerExcludeSQL(vids []string) (string, []any) {
	if len(vids) == 0 {
		return "", nil
	}
	ph := strings.TrimSuffix(strings.Repeat("?,", len(vids)), ",")
	args := make([]any, len(vids))
	for i, v := range vids {
		args[i] = v
	}
	return " AND visitor_id NOT IN (" + ph + ")", args
}

// SiteStatsSummary 网站浏览双口径统计（净屏 2026-10-08 修复同款）：Human=真人
// 口径（is_bot=0 的行；NULL 不计入，防历史爬虫经默认值混入），Raw=原始全量
// 对照（卡面 label 与明细共同消费，非死数据）。
type SiteStatsSummary struct {
	PvTodayHuman, UvTodayHuman int64
	PvTodayRaw, UvTodayRaw     int64
	PvTotalHuman, UvTotalHuman int64
	PvTotalRaw, UvTotalRaw     int64
}

// SiteStats 网站浏览 PV/UV：今日（北京时间零点起）与累计，真人/原始双口径。
// 真人口径叠加站长剔除（OwnerVids）；Raw 恒全量对照。
func (s *Store) SiteStats() (SiteStatsSummary, error) {
	var d SiteStatsSummary
	t0 := osv.Today0CST()
	oEx, oArgs := ownerExcludeSQL(s.OwnerVids())
	humanTodayArgs := append([]any{t0}, oArgs...)
	if err := s.db.QueryRow(`SELECT COUNT(*), COUNT(DISTINCT visitor_id) FROM site_visits WHERE at>=? AND is_bot=0`+oEx,
		humanTodayArgs...).Scan(&d.PvTodayHuman, &d.UvTodayHuman); err != nil {
		return d, err
	}
	if err := s.db.QueryRow(`SELECT COUNT(*), COUNT(DISTINCT visitor_id) FROM site_visits WHERE at>=?`,
		t0).Scan(&d.PvTodayRaw, &d.UvTodayRaw); err != nil {
		return d, err
	}
	if err := s.db.QueryRow(`SELECT COUNT(*), COUNT(DISTINCT visitor_id) FROM site_visits WHERE is_bot=0`+oEx,
		oArgs...).Scan(&d.PvTotalHuman, &d.UvTotalHuman); err != nil {
		return d, err
	}
	err := s.db.QueryRow(`SELECT COUNT(*), COUNT(DISTINCT visitor_id) FROM site_visits`).
		Scan(&d.PvTotalRaw, &d.UvTotalRaw)
	return d, err
}

// RecordDownload 记录一次下载点击（B 方案：网站侧热度，按 visitor 近似去重；
// 仅官网按钮 beacon 单一来源，APK 请求不另计防与按钮双计——净屏拍板）。
func (s *Store) RecordDownload(vid string) error {
	if vid == "" {
		return nil
	}
	_, err := s.db.Exec(`INSERT INTO site_downloads(visitor_id,at) VALUES(?,?)`, vid, time.Now().Unix())
	return err
}

// DownloadStats 下载统计：点击次数与去重独立访客。w="today" 取今日（北京时间
// 零点起，卡面今日口径）；其余/空=累计（同 BuyClickStats 惯例）。
func (s *Store) DownloadStats(w string) (clicks, unique int64, err error) {
	q := `SELECT COUNT(*), COUNT(DISTINCT visitor_id) FROM site_downloads`
	args := []any{}
	if w == "today" {
		q += ` WHERE at>=?`
		args = append(args, osv.Today0CST())
	}
	err = s.db.QueryRow(q, args...).Scan(&clicks, &unique)
	return
}

// BuyClickStats 购买入口点击：两入口点击数（渠道归因大盘；明细走 BuyClickDetail）。
// w="today" 取今日（北京时间零点起，卡面今日口径）；其余/空=累计。拾音现仅
// xianyu kind（官网无购买按钮，/site/xianyu 恒 App 端上报），shop 列恒 0 保留
// 净屏同构查询——未来接小店入口零改动。
func (s *Store) BuyClickStats(w string) (xianyu, shop int64, err error) {
	q := `SELECT COALESCE(SUM(kind='xianyu'),0), COALESCE(SUM(kind='shop'),0) FROM site_buy_clicks`
	args := []any{}
	if w == "today" {
		q += ` WHERE at>=?`
		args = append(args, osv.Today0CST())
	}
	err = s.db.QueryRow(q, args...).Scan(&xianyu, &shop)
	return
}

// ---------- 看板明细三件（净屏 dashboard.go 同构；表同构故 SQL 形状一致） ----------

// VisitDetail 浏览明细：主表=页面聚合 PV/UV，Extra=打开环境分布（含渠道 Top
// 挂标题），More=访客轨迹明细。w 为时间窗 today|7d|30d|all（空按 metric 自带
// 口径），三个表同窗过滤。
func (s *Store) VisitDetail(metric string, w string) (*osv.DashDetail, error) {
	if w == "" {
		if metric == "visit_today" {
			w = "today"
		} else {
			w = "all"
		}
	}
	var cutoff, winDays int64
	switch w {
	case "today":
		cutoff, winDays = osv.Today0CST(), 1
	case "7d":
		winDays = 7
	case "30d":
		winDays = 30
	case "all":
	default:
		return nil, fmt.Errorf("unknown window %q", w)
	}
	if winDays > 1 {
		cutoff = time.Now().Unix() - winDays*86400
	}
	// 主表真人口径（is_bot=0）。爬虫行不进聚合但保留在下方访客轨迹（类型列），
	// 数据可查证。站长自测 vid 同步剔除（净屏 2026-10-16 拍板）。
	oEx, oArgs := ownerExcludeSQL(s.OwnerVids())
	q := `SELECT COALESCE(page,'-'), COUNT(*), COUNT(DISTINCT visitor_id), MAX(at) FROM site_visits WHERE is_bot=0` + oEx
	args := append([]any{}, oArgs...)
	if cutoff > 0 {
		q += ` AND at>=?`
		args = append(args, cutoff)
	}
	q += ` GROUP BY page ORDER BY COUNT(*) DESC LIMIT 200`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	// 标题随窗口走（7d/30d 为用户在 modal 内切换的时间窗，非固定口径）。
	title := "累计浏览·真人(PV/UV)"
	switch w {
	case "today":
		title = "今日浏览·真人(PV/UV)"
	case "7d":
		title = "近7天浏览·真人(PV/UV)"
	case "30d":
		title = "近30天浏览·真人(PV/UV)"
	}
	d := &osv.DashDetail{Title: title, Cols: []string{"页面", "PV", "UV", "最近访问时间"}}
	for rows.Next() {
		var page string
		var pv, uv, lastAt int64
		if err := rows.Scan(&page, &pv, &uv, &lastAt); err != nil {
			return nil, err
		}
		d.Rows = append(d.Rows, []string{pageLabel(page), strconv.FormatInt(pv, 10), strconv.FormatInt(uv, 10), osv.FmtTimeCST(lastAt)})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	env, err := s.siteEnvDetail(w, cutoff)
	if err != nil {
		return nil, err
	}
	if env != nil {
		d.Extra = env
	}
	log, err := s.visitorLogDetail(w, cutoff)
	if err != nil {
		return nil, err
	}
	if log != nil {
		d.More = log
	}
	return d, nil
}

// siteEnvDetail 打开环境分布（净屏浏览来源能力②同文）：真人口径（is_bot=0，
// 站长自测剔除）按 UA 原文分组聚合 PV/UV，Go 侧 SiteEnv 归并为环境行，按 PV
// 倒序；环境超 14 个时尾部合并为「其他」单行（看板分布可读性）。空 UA=未知
// （存量行）单列。渠道 Top 挂 Extra 标题（v1 权宜：弹窗只认 extra/more 两区块
// 槽位）；站长剔除同叠，防站长渠道自测污染渠道 UV。
func (s *Store) siteEnvDetail(w string, cutoff int64) (*osv.DashDetail, error) {
	oEx, oArgs := ownerExcludeSQL(s.OwnerVids())
	q := `SELECT ua, COUNT(*), COUNT(DISTINCT visitor_id) FROM site_visits WHERE is_bot=0` + oEx
	args := append([]any{}, oArgs...)
	if cutoff > 0 {
		q += ` AND at>=?`
		args = append(args, cutoff)
	}
	q += ` GROUP BY ua ORDER BY COUNT(*) DESC LIMIT 500`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type envStat struct{ pv, uv int64 }
	byEnv := map[string]*envStat{}
	for rows.Next() {
		var ua string
		var pv, uv int64
		if err := rows.Scan(&ua, &pv, &uv); err != nil {
			return nil, err
		}
		e, ok := byEnv[SiteEnv(ua)]
		if !ok {
			e = &envStat{}
			byEnv[SiteEnv(ua)] = e
		}
		e.pv += pv
		e.uv += uv
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(byEnv) == 0 {
		return nil, nil
	}
	title := "打开环境分布（真人）"
	chq := `SELECT channel, COUNT(DISTINCT visitor_id) FROM site_visits WHERE is_bot=0 AND channel<>''` + oEx
	chArgs := append([]any{}, oArgs...)
	if cutoff > 0 {
		chq += ` AND at>=?`
		chArgs = append(chArgs, cutoff)
	}
	chq += ` GROUP BY channel ORDER BY COUNT(DISTINCT visitor_id) DESC LIMIT 5`
	chRows, err := s.db.Query(chq, chArgs...)
	if err != nil {
		return nil, err
	}
	var chTop []string
	for chRows.Next() {
		var name string
		var uv int64
		if err := chRows.Scan(&name, &uv); err != nil {
			chRows.Close()
			return nil, err
		}
		chTop = append(chTop, name+"×"+strconv.FormatInt(uv, 10))
	}
	if err := chRows.Err(); err != nil {
		chRows.Close()
		return nil, err
	}
	chRows.Close()
	if len(chTop) > 0 {
		title += " · 渠道Top " + strings.Join(chTop, " ")
	}
	type kv struct {
		name   string
		pv, uv int64
	}
	list := make([]kv, 0, len(byEnv))
	for k, v := range byEnv {
		list = append(list, kv{k, v.pv, v.uv})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].pv > list[j].pv })
	d := &osv.DashDetail{Title: title, Cols: []string{"环境", "PV", "UV"}}
	for i, e := range list {
		if i >= 14 {
			restPv, restUv := int64(0), int64(0)
			for _, e2 := range list[i:] {
				restPv += e2.pv
				restUv += e2.uv
			}
			d.Rows = append(d.Rows, []string{"其他", strconv.FormatInt(restPv, 10), strconv.FormatInt(restUv, 10)})
			break
		}
		d.Rows = append(d.Rows, []string{e.name, strconv.FormatInt(e.pv, 10), strconv.FormatInt(e.uv, 10)})
	}
	return d, nil
}

// visitorLogDetail 访客级浏览流水（净屏同文，对标 Matomo Visitor Log）：每行
// 一个访客，「浏览轨迹」列串出「HH:MM 页面名 → HH:MM 页面名」（今日口径只带
// 时刻；其余窗口带日期）。访客=浏览器 visitor_id（localStorage 随机 id，非
// 真实用户身份），IP 列辅助识别同源访客。「类型」列三态：真人(0)/爬虫(1)/
// 未知(NULL 存量行)——爬虫行保留展示，聚合层已剔除，供人工核证。站长名单 vid
// 恒标「本人」（身份优先于类型）。截断语义：流水按时间倒序取 5000 条——超限
// 自然淘汰最老记录；访客按最近浏览倒序取前 200。
func (s *Store) visitorLogDetail(w string, cutoff int64) (*osv.DashDetail, error) {
	ownerSet := map[string]bool{}
	for _, v := range s.OwnerVids() {
		ownerSet[v] = true
	}
	q := `SELECT visitor_id, COALESCE(page,'-'), ip, at, COALESCE(is_bot,-1), COALESCE(ua,''), COALESCE(referer,''), COALESCE(channel,'') FROM site_visits`
	args := []any{}
	if cutoff > 0 {
		q += ` WHERE at>=?`
		args = append(args, cutoff)
	}
	q += ` ORDER BY at DESC LIMIT 5000`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type vlog struct {
		ip     string
		lastAt int64
		bot    int      // 最近一条上报的 is_bot；-1=未知（存量行），0=真人，1=爬虫
		env    string   // 最近一条的打开环境（SiteEnv）
		ref    string   // 最近一条的来源（直接打开/来源域）
		ch     string   // 最近一条的渠道标记（?from= 首触，空=无标记链接）
		steps  []string // 倒序收集，展示前反转为时间正序
	}
	byVisitor := map[string]*vlog{}
	order := []string{} // 首次出现序，便于稳定排序
	for rows.Next() {
		var vid, page, ip, ua, ref, ch string
		var at, bot int64
		if err := rows.Scan(&vid, &page, &ip, &at, &bot, &ua, &ref, &ch); err != nil {
			return nil, err
		}
		v, ok := byVisitor[vid]
		if !ok {
			// 首见即定（净屏 2026-10-14 修复同款）：流水是 at DESC，首见=窗口内
			// 【最新】一条——六个概要字段必须在此一次定型，循环内再覆盖会退化成最早
			v = &vlog{
				ip:     ip,
				lastAt: at,
				bot:    int(bot),
				env:    SiteEnv(ua),
				ref:    refSource(ref),
				ch:     ch,
			}
			byVisitor[vid] = v
			order = append(order, vid)
		}
		t := time.Unix(at, 0).In(osv.CSTZone)
		tpl := "01-02 15:04"
		if w == "today" {
			tpl = "15:04"
		}
		v.steps = append(v.steps, t.Format(tpl)+" "+pageLabel(page))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	d := &osv.DashDetail{Title: "访客明细（最近活跃 200 位，超出以最近浏览时间保留）",
		Cols: []string{"访客", "类型", "环境", "来源", "渠道", "IP", "浏览次数", "最近浏览", "浏览轨迹"}}
	sort.Slice(order, func(i, j int) bool { return byVisitor[order[i]].lastAt > byVisitor[order[j]].lastAt })
	if len(order) > 200 {
		order = order[:200]
	}
	for _, vid := range order {
		v := byVisitor[vid]
		// 流水按时间倒序收集，轨迹展示反转为正序（先看 → 后看）
		for i, j := 0, len(v.steps)-1; i < j; i, j = i+1, j-1 {
			v.steps[i], v.steps[j] = v.steps[j], v.steps[i]
		}
		id := vid
		if len(id) > 8 {
			id = id[:8] + "…"
		}
		botLabel := "未知"
		switch v.bot {
		case 0:
			botLabel = "真人"
		case 1:
			botLabel = "爬虫"
		}
		if ownerSet[vid] {
			botLabel = "本人"
		}
		d.Rows = append(d.Rows, []string{
			id, botLabel, v.env, v.ref, v.ch, v.ip, strconv.Itoa(len(v.steps)), osv.FmtTimeCST(v.lastAt), strings.Join(v.steps, " → "),
		})
	}
	return d, nil
}

// pageLabel 官网页面路径→中文展示名（拾音干净路径+容错 .html 变体）；未知路径
// 原样返回。
func pageLabel(page string) string {
	p := strings.TrimSpace(page)
	if i := strings.IndexByte(p, '?'); i >= 0 {
		p = p[:i]
	}
	switch p {
	case "", "/", "/index.html":
		return "首页"
	case "/download", "/download.html":
		return "下载"
	case "/tutorial", "/tutorial.html":
		return "使用教程"
	case "/faq", "/faq.html":
		return "常见问题"
	case "/privacy", "/privacy.html":
		return "隐私协议"
	}
	return p
}

// DownloadDetail 下载点击明细（净屏同文）：官网下载按钮点击流水。
func (s *Store) DownloadDetail() (*osv.DashDetail, error) {
	rows, err := s.db.Query(`SELECT visitor_id, at FROM site_downloads ORDER BY at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	d := &osv.DashDetail{Title: "App 下载点击", Cols: []string{"访客", "时间"}}
	for rows.Next() {
		var vid string
		var at int64
		if err := rows.Scan(&vid, &at); err != nil {
			return nil, err
		}
		d.Rows = append(d.Rows, []string{vid, osv.FmtTimeCST(at)})
	}
	return d, rows.Err()
}

// BuyClickDetail 购买入口点击明细（净屏同构；拾音现仅闲鱼入口且恒 App 端上报
// ——官网无购买按钮，title 随注记自解释，看板补齐审查 S-9）。结果列中文展示：
// DB 存英文枚举（App 上报协议不动），仅明细渲染层映射；白名单外兜底原样。
// w=时间窗 today|7d|30d|all（空按今日）；source=all|web|app 来源筛选（空=all）。
func (s *Store) BuyClickDetail(w, source string) (*osv.DashDetail, error) {
	if w != "7d" && w != "30d" && w != "all" {
		w = "today"
	}
	if source != "web" && source != "app" {
		source = "all"
	}
	cutoff := osv.SalesWindowFrom(w)
	q := `SELECT kind, visitor_id, at, result, source FROM site_buy_clicks WHERE 1=1`
	args := []any{}
	if cutoff > 0 {
		q += ` AND at>=?`
		args = append(args, cutoff)
	}
	if source != "all" {
		q += ` AND source=?`
		args = append(args, source)
	}
	q += ` ORDER BY at DESC LIMIT 200`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	title := osv.SalesWindowLabel(w) + "购买入口点击（最近 200 条；来源恒 App 端，官网无购买按钮）"
	switch source {
	case "web":
		title += "·仅官网"
	case "app":
		title += "·仅App"
	}
	d := &osv.DashDetail{Title: title, Cols: []string{"入口", "访客", "结果", "来源", "时间"}}
	resultLabel := map[string]string{
		"scheme":   "拉起成功",
		"fallback": "降级网页版",
		"legacy":   "旧版直跳",
	}
	for rows.Next() {
		var kind, vid, result, src string
		var at int64
		if err := rows.Scan(&kind, &vid, &at, &result, &src); err != nil {
			return nil, err
		}
		name := kind
		if kind == "xianyu" {
			name = "闲鱼"
		} else if kind == "shop" {
			name = "小店"
		}
		lbl, ok := resultLabel[result]
		if !ok {
			lbl = result
		}
		d.Rows = append(d.Rows, []string{name, vid, lbl, src, osv.FmtTimeCST(at)})
	}
	return d, rows.Err()
}

package admin

import (
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"shiyin/backend/store"
)

// 看板补齐批单测（2026-11-03；审查定稿测试策略）：dashSection 12 卡齐全与
// 卡序（漏斗序：销售 4 卡→浏览→下载→试用→购买）、试用对卡依赖 srv 缓存失败
// 静默不渲染（不造 0 值假卡）、dash_metric 新 case 形状、未知 metric 文案。

func newTestPanel(t *testing.T) *PanelServer {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "panel-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return &PanelServer{St: st, Token: "t"}
}

func dashCards(t *testing.T, ps *PanelServer) []map[string]any {
	t.Helper()
	w := httptest.NewRecorder()
	ps.handleSummary(w, httptest.NewRequest("GET", "/panel/summary", nil))
	if w.Code != 200 {
		t.Fatalf("summary 应 200: %d %s", w.Code, w.Body.String())
	}
	var out struct {
		Sections []map[string]any `json:"sections"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	for _, sec := range out.Sections {
		if sec["id"] == "dash" {
			cards, _ := sec["cards"].([]any)
			var out []map[string]any
			for _, c := range cards {
				out = append(out, c.(map[string]any))
			}
			return out
		}
	}
	t.Fatal("无 dash 分区")
	return nil
}

func cardIDs(cards []map[string]any) []string {
	ids := make([]string, 0, len(cards))
	for _, c := range cards {
		ids = append(ids, c["id"].(string))
	}
	return ids
}

func TestDashSectionCardOrderAndIds(t *testing.T) {
	ps := newTestPanel(t)
	// 预置：浏览（真人+爬虫）与购买点击，观测卡渲染
	if err := ps.St.RecordSiteVisit("vid-A", "/", "1.2.3.4",
		"Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0 Safari/537.36", "", ""); err != nil {
		t.Fatal(err)
	}
	if err := ps.St.RecordBuyClick("xianyu", "vid-A", "scheme", "app"); err != nil {
		t.Fatal(err)
	}
	if err := ps.St.RecordDownload("vid-A"); err != nil {
		t.Fatal(err)
	}
	ids := cardIDs(dashCards(t, ps))
	want := []string{
		"sales_today", "sales_total", "today_orders", "pending_delivery",
		"pv_today", "pv_total",
		"download_today", "download_total",
		// 试用对卡：SRVClient 未注入 → dashWithCache 报错 → 整对不渲染（S-1 修订语义）
		"buy_today", "buy_total",
	}
	if len(ids) != len(want) {
		t.Fatalf("卡数应 %d（srv 未配置试用对卡不渲染）: %v", len(want), ids)
	}
	for i, id := range want {
		if ids[i] != id {
			t.Fatalf("卡序应漏斗序 %v: got %v", want, ids)
		}
	}
}

func TestDashMetricVisitDownloadBuy(t *testing.T) {
	ps := newTestPanel(t)
	if err := ps.St.RecordSiteVisit("vid-A", "/", "1.2.3.4",
		"Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0 Safari/537.36", "https://out.example", "ad1"); err != nil {
		t.Fatal(err)
	}
	if err := ps.St.RecordDownload("vid-D"); err != nil {
		t.Fatal(err)
	}
	if err := ps.St.RecordBuyClick("xianyu", "vid-D", "scheme", "app"); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		metric string
		check  func(t *testing.T, body map[string]any)
	}{
		{"visit_today", func(t *testing.T, body map[string]any) {
			if body["title"] != "今日浏览·真人(PV/UV)" {
				t.Fatalf("visit 标题不符: %v", body["title"])
			}
			if body["extra"] == nil || body["more"] == nil {
				t.Fatal("visit 明细应带 extra/more 区块")
			}
		}},
		{"download", func(t *testing.T, body map[string]any) {
			rows := body["rows"].([]any)
			if len(rows) != 1 {
				t.Fatalf("download 明细应 1 行: %v", rows)
			}
		}},
		{"buy", func(t *testing.T, body map[string]any) {
			title, _ := body["title"].(string)
			if title == "" || !strings.Contains(title, "来源恒 App 端") {
				t.Fatalf("buy 明细 title 应带来源注记: %v", title)
			}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.metric, func(t *testing.T) {
			w := httptest.NewRecorder()
			ps.handleQuery(w, httptest.NewRequest("GET", "/panel/query?kind=dash_metric&metric="+tc.metric, nil))
			if w.Code != 200 {
				t.Fatalf("%s 应 200: %d %s", tc.metric, w.Code, w.Body.String())
			}
			var body map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			tc.check(t, body)
		})
	}
}

func TestDashMetricUnknownMessage(t *testing.T) {
	ps := newTestPanel(t)
	w := httptest.NewRecorder()
	ps.handleQuery(w, httptest.NewRequest("GET", "/panel/query?kind=dash_metric&metric=bogus", nil))
	if w.Code != 400 {
		t.Fatalf("未知 metric 应 400: %d", w.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	want := "未知 metric（拾音开放：sales_today/sales_total/trial/visit_today/visit_total/download/buy）"
	if body["error"] != want {
		t.Fatalf("开放清单文案应同步: %q", body["error"])
	}
}

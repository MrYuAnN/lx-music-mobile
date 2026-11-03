// site_test.go 官网埋点端点单测（看板补齐批 2026-11-03 代码审 PM I-1 补装；
// 方案 §一测试策略明列项）：/site/visit /site/download 校验矩阵（vid 空/超长、
// page/ref 超长=400；from 白名单归一非 400）、入库行内容（UA 原文/is_bot 判定/
// 渠道白名单）、siteEndpoint 429 限流（60/日/IP 共桶、UTC 日切清零语义随实现
// 不在测试内回拨——日切行为与净屏同文搬运由源码注释单源）。
package api

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"shiyin/backend/store"
)

func newSiteTestServer(t *testing.T) *Server {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "site-api-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return &Server{St: st}
}

func postJSON(h http.HandlerFunc, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", "/site/x", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h(w, req)
	return w
}

func TestSiteVisitValidationAndRow(t *testing.T) {
	s := newSiteTestServer(t)
	// 400 矩阵：bad json / vid 空 / vid 超长 / page 超长 / ref 超长
	bad := []string{
		`not-json`,
		`{"page":"/"}`,
		`{"visitor_id":"` + strings.Repeat("v", 129) + `","page":"/"}`,
		`{"visitor_id":"v1","page":"` + strings.Repeat("p", 201) + `"}`,
		`{"visitor_id":"v1","page":"/","ref":"` + strings.Repeat("r", 501) + `"}`,
	}
	for i, body := range bad {
		if w := postJSON(s.handleSiteVisit, body); w.Code != 400 {
			t.Fatalf("bad[%d] 应 400: %d %s", i, w.Code, w.Body.String())
		}
	}
	// 成功：UA 原文入库+is_bot 判定；from 白名单外归一空串（宽容原则非 400）
	req := httptest.NewRequest("POST", "/site/visit", strings.NewReader(
		`{"visitor_id":"vid-A","page":"/download","ref":"https://out.example/x","from":"百度!"}`))
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0 Safari/537.36")
	req.Header.Set("X-Real-IP", "9.8.7.6")
	w := httptest.NewRecorder()
	s.handleSiteVisit(w, req)
	if w.Code != 200 {
		t.Fatalf("正常上报应 200: %d %s", w.Code, w.Body.String())
	}
	var vid, ua, ip, page, ch string
	var bot int
	err := s.St.DB().QueryRow(`SELECT visitor_id, ua, ip, page, COALESCE(channel,''), COALESCE(is_bot,-1)
		FROM site_visits WHERE visitor_id='vid-A'`).Scan(&vid, &ua, &ip, &page, &ch, &bot)
	if err != nil {
		t.Fatal(err)
	}
	if ip != "9.8.7.6" || page != "/download" || ch != "" || bot != 0 || !strings.Contains(ua, "Chrome/126") {
		t.Fatalf("入库行不符: vid=%s ua=%q ip=%s page=%s ch=%q bot=%d", vid, ua, ip, page, ch, bot)
	}
	// 空 vid 静默忽略（store 层隐私语义）→ 200 无行
	if w := postJSON(s.handleSiteDownload, `{"visitor_id":""}`); w.Code != 400 {
		t.Fatalf("download 空 vid 应 400（端点层校验）: %d", w.Code)
	}
}

func TestSiteDownloadAndRateLimit(t *testing.T) {
	s := newSiteTestServer(t)
	if w := postJSON(s.handleSiteDownload, `{"visitor_id":"vid-D"}`); w.Code != 200 {
		t.Fatalf("download 正常应 200: %d", w.Code)
	}
	var n int
	if err := s.St.DB().QueryRow(`SELECT COUNT(*) FROM site_downloads WHERE visitor_id='vid-D'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("download 应落 1 行: %d %v", n, err)
	}

	// 429：共桶语义（visit/download/xianyu 同桶计数；生产桶 6000/日/IP，测试注入
	// 小桶 3 验证行为同构——日切清零逻辑与净屏同文搬运由源码注释单源）
	s.siteLim = newSiteLimiter(3)
	var got429 bool
	for i := 0; i < 4; i++ {
		req := httptest.NewRequest("POST", "/site/visit", strings.NewReader(`{"visitor_id":"vid-flood","page":"/"}`))
		req.Header.Set("X-Real-IP", "6.6.6.6")
		w := httptest.NewRecorder()
		s.siteEndpoint(s.handleSiteVisit)(w, req)
		if w.Code == 429 {
			got429 = true
			if !strings.Contains(w.Body.String(), "rate_limited") {
				t.Fatalf("429 体应 rate_limited: %s", w.Body.String())
			}
			break
		}
		if w.Code != 200 {
			t.Fatalf("flood[%d] 预期 200/429: %d", i, w.Code)
		}
	}
	if !got429 {
		t.Fatal("超小桶限额应 429")
	}
	// 其他 IP 独立计数
	req := httptest.NewRequest("POST", "/site/visit", strings.NewReader(`{"visitor_id":"vid-ok","page":"/"}`))
	req.Header.Set("X-Real-IP", "7.7.7.7")
	w := httptest.NewRecorder()
	s.siteEndpoint(s.handleSiteVisit)(w, req)
	if w.Code != 200 {
		t.Fatalf("他 IP 不应受累: %d", w.Code)
	}
}

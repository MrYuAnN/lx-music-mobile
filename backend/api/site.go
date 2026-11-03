// site.go 官网埋点端点与 IP 限流（看板补齐批 2026-11-03）。限流=净屏
// internal/ratelimit+jgate.SiteEndpoint 同语义搬运（架构席审查 I-1 处置：原
// /site/xianyu 批5 搬运时丢限流层，本批补齐）；SiteEndpoint 的 CORS/OPTIONS
// 预检/product 校验三段因拾音官网与 API 同源同进程省去（定稿 v3 拍板）。
// 限流口径=每 IP 每日计数（UTC 日切清零、进程内 map，重启清零与净屏一致），
// site 桶 6000/日/IP。阈值无业界对标（2026-11-03 代码审 PM I-2 检索核实：
// Matomo「不对 Tracking API 限流」、Plausible 自托管 beacon 无内置 per-IP 限、
// GA4 节流按 client/device 维度——埋点采集端点业界均不做 per-IP 日额限流），
// 本产品自定：数值对齐 usage 批 IP 粗防呆桶 6000 同仓先例（CGNAT 共享出口 IP
// 多真人共桶不误伤，2026-11-03 用户拍板自 60 抬高）。visit/download/xianyu
// 三端点共桶（净屏 SiteEndpoint 同参）。
package api

import (
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"
)

// sitePerDayPerIP site 桶限额（次/日/IP；6000=usage 批 IP 粗防呆桶同值，见上）。
const sitePerDayPerIP = 6000

// siteLimiter 每 IP 每日计数限流（净屏 ratelimit.Limiter 同文搬运）。
type siteLimiter struct {
	mu    sync.Mutex
	day   string
	n     map[string]int
	limit int
}

func newSiteLimiter(limit int) *siteLimiter {
	return &siteLimiter{n: make(map[string]int), limit: limit}
}

func (l *siteLimiter) allow(key string) bool {
	today := time.Now().UTC().Format("2006-01-02")
	l.mu.Lock()
	defer l.mu.Unlock()
	if today != l.day {
		l.day = today
		l.n = make(map[string]int)
	}
	if l.n[key] >= l.limit {
		return false
	}
	l.n[key]++
	return true
}

// siteRateLimiter Server 级惰性单例（Server 经结构体字面量构造无构造函数钩子；
// 测试各建新 Server 互不共桶；siteLim 已直接注入时（测试小桶）优先用注入值）。
func (s *Server) siteRateLimiter() *siteLimiter {
	if s.siteLim != nil {
		return s.siteLim
	}
	s.siteLimOnce.Do(func() { s.siteLim = newSiteLimiter(sitePerDayPerIP) })
	return s.siteLim
}

// siteEndpoint 官网埋点包装（净屏 SiteEndpoint 拾音裁剪版：仅 IP 限流段——
// 方法约束由 mux "POST /" 模式承担，超限 429 rate_limited）。
func (s *Server) siteEndpoint(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.siteRateLimiter().allow(clientIP(r)) {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate_limited"})
			return
		}
		h(w, r)
	}
}

// handleSiteVisit 网站 PV/UV 埋点（净屏同文）：body {visitor_id, page, ref,
// from}。UA 取 HTTP 头原文下传（store 侧先判定 is_bot 再截断入库）；ref=官网
// JS 上报的 document.referrer；from=渠道标记（客户端首触持久化的 ?from=，store
// 层 SanitizeChannel 白名单校验）。vid 空/超长、page/ref 超长=400（宽容原则
// 仅适用取值归一，长度硬限与净屏逐字一致）。
func (s *Server) handleSiteVisit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		VisitorID string `json:"visitor_id"`
		Page      string `json:"page"`
		Ref       string `json:"ref"`
		From      string `json:"from"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&req); err != nil ||
		req.VisitorID == "" || len(req.VisitorID) > 128 || len(req.Page) > 200 || len(req.Ref) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	if err := s.St.RecordSiteVisit(req.VisitorID, req.Page, clientIP(r), r.Header.Get("User-Agent"), req.Ref, req.From); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handleSiteDownload 下载点击统计（净屏同文，B 方案：仅官网按钮 beacon，
// APK 请求不另计防双计）：body {visitor_id}。
func (s *Server) handleSiteDownload(w http.ResponseWriter, r *http.Request) {
	var req struct {
		VisitorID string `json:"visitor_id"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&req); err != nil ||
		req.VisitorID == "" || len(req.VisitorID) > 128 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	if err := s.St.RecordDownload(req.VisitorID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

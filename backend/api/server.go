// Package api：拾音业务轻服务 HTTP 面。
//
// 端点职责（方案 doc/plans/self-hosted-music-server.md §七）：
//   - GET /latest   App 升级通道：{version,url,note,releases[≤30]}，全空 404
//     （客户端静默跳过）；CORS 开放供官网跨域读「当前版本」。
//     永不设版本门槛（版本过低的客户端恰靠它获知升级地址）。
//   - GET /dash     看板页：服务端代理 license-platform /srv/dash
//     （X-Product + X-Product-Token 鉴权），浏览器经 ?token= 访问。
//   - 其余路径      官网静态页（web/ 目录，移动优先零依赖）。
//
// 网关侧（nginx-gateway 拾音专用 server block）按 path 分流到本服务与取链
// 服务/平台；本服务只绑内网（172.20.0.x），公网流量一律经网关。
package api

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	orderxianyu "ordercore/xianyu"

	"shiyin/backend/admin"
	"shiyin/backend/store"
)

// Server 轻服务运行时依赖。
type Server struct {
	St           *store.Store
	PlatformBase string // license-platform 内网基址（如 http://172.20.0.1:8080）
	SrvToken     string // 平台 srv API 凭证（X-Product-Token；空=/dash 503）
	DashToken    string // 看板页访问令牌（空=/dash 404 隐藏入口）
	WebDir       string // 官网静态页根目录
	HTTP         *http.Client
	// XY 闲鱼 itemId 解析器（批2：/api/skus 与下单返回体下发 xianyu_item_id；
	// nil=空串退现状——解析器永远不阻塞主链路）
	XY *orderxianyu.Resolver
	// Panel 业务面板（批2；PanelToken 空=面板路由不注册）
	PanelToken string

	// siteLim/siteLimOnce 官网埋点限流惰性单例（看板补齐批 2026-11-03，见 site.go）
	siteLimOnce sync.Once
	siteLim     *siteLimiter
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	// JSON 端点一律 no-store：/latest（升级触达时效）与 /dash（看板时效+带 token）
	// 不允许被任何中间层缓存（2026-10-26 审查 I-2）
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Handler 装配全部路由（批2 追加：订单/商品 API+业务面板——8090 mux 并入，
// 方案选型 B：零进程结构变更，回滚=摘网关 location 即回平台 8080）。
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	mux.HandleFunc("GET /latest", s.handleLatest)
	mux.HandleFunc("GET /dl/latest", s.handleLatestApk)
	mux.HandleFunc("GET /dash", s.handleDash)
	// 订单/商品 API（网关精确路径接管：=/api/skus、/api/order/、=/api/orders）
	mux.HandleFunc("GET /api/skus", s.handleApiSkus)
	mux.HandleFunc("POST /api/order/create", s.handleNativeOrderCreate)
	mux.HandleFunc("GET /api/orders", s.handleNativeOrders)
	mux.HandleFunc("POST /api/order/cancel", s.handleNativeOrderCancel)
	// F-09（批5）：闲鱼归因点击埋点（净屏 /site/xianyu 同语义；App 端 fire-and-forget，
	// 白名单外取值宽容归一不 400 丢行——审查定稿埋点宽容原则）。
	// 看板补齐批（2026-11-03）：三 site 端点统一过 IP 限流（siteEndpoint——原
	// 批5 裸注册丢限流层，架构席审查 I-1 补齐）+新增 visit/download 两端点
	mux.HandleFunc("POST /site/xianyu", s.siteEndpoint(s.handleSiteBuyClick("xianyu")))
	mux.HandleFunc("POST /site/visit", s.siteEndpoint(s.handleSiteVisit))
	mux.HandleFunc("POST /site/download", s.siteEndpoint(s.handleSiteDownload))
	// 业务面板（X-Panel-Token 服务间鉴权；平台管理台 per-product 代理接入）
	if s.PanelToken != "" {
		admin.RegisterPanelRoutes(mux, &admin.PanelServer{St: s.St, Token: s.PanelToken})
	}
	mux.Handle("/", s.staticHandler())
	return logMiddleware(mux)
}

// handleLatest 升级通道（发布唯一数据源 app_releases 表首=最新；全空 404）。
// 无版本门槛、无鉴权——与净屏 handleLatest 同构；response shape 变更须同步
// App 批1 更新检查实现与官网 download 页两处消费方。
// url 恒为稳定入口（2026-11-01 历史版本下载面收敛，与净屏同款：版本化直链
// 已收进 nginx internal 不可拼接；登记值保留版本化供审计可溯）。
func (s *Server) handleLatest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	rels, err := s.St.ListReleases(30)
	if err != nil {
		log.Printf("latest: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	if len(rels) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_configured"})
		return
	}
	latest := rels[0]
	// W3-16（批5）：releases[].url 版本化直链在 /dl/ internal 收敛后恒 404（数据
	// 卫生）——下发时统一派生稳定入口杜绝未来消费方踩死链；登记值保留原样供审计
	relsOut := make([]store.Release, len(rels))
	for i, r := range rels {
		r.URL = latestStableURL(r.URL)
		relsOut[i] = r
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"version": latest.Version, "url": latestStableURL(latest.URL), "note": latest.Note,
		"releases": relsOut,
	})
}

// latestStableURL 登记 url 派生稳定下载入口（保 scheme+host、path 换 /dl/latest
// ——域名无关：对外域 shiyinbox.top 与回源域变化零代码改动）。
func latestStableURL(releaseURL string) string {
	u, err := url.Parse(releaseURL)
	if err != nil || u.Host == "" {
		return releaseURL
	}
	return u.Scheme + "://" + u.Host + "/dl/latest"
}

// handleLatestApk APK 稳定下载入口数据面（2026-11-01，与净屏同款收敛）：
// X-Accel-Redirect 内部重定向到 nginx /dl/（internal）真实版本化文件——外网
// 直连任何 /dl/shiyin-vX.apk 一律 404，拼接失效。Content-Disposition 显式
// 版本化文件名（落盘名不随入口退化）；no-store 防稳定入口缓存滞留旧包。
func (s *Server) handleLatestApk(w http.ResponseWriter, _ *http.Request) {
	rels, err := s.St.ListReleases(30)
	if err != nil {
		log.Printf("latest-apk: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	if len(rels) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_configured"})
		return
	}
	u, err := url.Parse(rels[0].URL)
	if err != nil || !strings.HasPrefix(u.Path, "/dl/") {
		// 登记值异常（非本站 dl 路径）：不猜下载面，404 静默；日志留痕
		log.Printf("latest-apk: 异常登记 url %q，拒绝下发", rels[0].URL)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_configured"})
		return
	}
	w.Header().Set("X-Accel-Redirect", u.Path)
	w.Header().Set("Content-Disposition", `attachment; filename="`+path.Base(u.Path)+`"`)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
}

// handleDash 看板页：轻服务代理平台 /srv/dash（srv token 只存服务端，
// 不落浏览器）。dash token 为低价值访问令牌经 query 传递（看板/魔法链接
// 惯例），但比较仍用恒定时间——对齐平台侧 X-Product-Token 同体系基线
// （2026-10-26 审查 I-3）。
func (s *Server) handleDash(w http.ResponseWriter, r *http.Request) {
	if s.DashToken == "" {
		http.NotFound(w, r)
		return
	}
	token := r.URL.Query().Get("token")
	if subtle.ConstantTimeCompare([]byte(token), []byte(s.DashToken)) != 1 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if s.SrvToken == "" || s.PlatformBase == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "srv_token_not_configured"})
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet,
		strings.TrimRight(s.PlatformBase, "/")+"/srv/dash", nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	req.Header.Set("X-Product", "shiyin")
	req.Header.Set("X-Product-Token", s.SrvToken)
	client := s.HTTP
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("dash: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "platform_unreachable"})
		return
	}
	defer resp.Body.Close()
	// 读 1MB+1 探测截断：平台响应超限时拒绝下发坏 JSON（2026-10-26 审查 S-10）
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20+1))
	if err != nil || resp.StatusCode != http.StatusOK {
		log.Printf("dash: platform status=%d err=%v", resp.StatusCode, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "platform_error"})
		return
	}
	if len(body) > 1<<20 {
		log.Printf("dash: platform response exceeds 1MB limit")
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "platform_error"})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(body)
}

// statusWriter 捕获响应状态码供访问日志记录（2026-10-26 审查 S-11）。
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.status, time.Since(start).Round(time.Millisecond))
	})
}

// staticHandler 官网静态页：干净路径（/、/download、/tutorial、/faq、/privacy）
// 映射 web/ 下同名 .html（容忍尾斜杠变体）；其余 404。零目录列目录。
func (s *Server) staticHandler() http.Handler {
	pages := map[string]string{
		"/":         "index.html",
		"/index":    "index.html",
		"/download": "download.html",
		"/tutorial": "tutorial.html",
		"/faq":      "faq.html",
		"/privacy":  "privacy.html",
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimRight(r.URL.Path, "/")
		if path == "" {
			path = "/"
		}
		page, ok := pages[path]
		if ok {
			serveFile(w, r, filepath.Join(s.WebDir, page))
			return
		}
		if strings.HasPrefix(r.URL.Path, "/static/") {
			serveFile(w, r, filepath.Join(s.WebDir, filepath.Clean(r.URL.Path)))
			return
		}
		http.NotFound(w, r)
	})
}

func serveFile(w http.ResponseWriter, r *http.Request, path string) {
	f, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || st.IsDir() {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, filepath.Base(path), st.ModTime(), f)
}

// handleSiteBuyClick 闲鱼归因点击埋点（F-09 批5，净屏 handleSiteBuyClick 同语义
// 搬运）：body {visitor_id, result, source}。result 记唤端结果（scheme=拉起成功/
// fallback=降级现状链接/legacy=解析失败或未配置），source 区分 App 端。埋点宽容
// 原则（净屏审查定稿）：result/source 白名单外与空值一律归一 legacy/web 不 400 丢
// 行；visitor_id 空/超长为唯一 400 项（审查 S-d 歧义勘误——勿据「宽容」误删该校验）。
func (s *Server) handleSiteBuyClick(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			VisitorID string `json:"visitor_id"`
			Result    string `json:"result"`
			Source    string `json:"source"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&req); err != nil ||
			req.VisitorID == "" || len(req.VisitorID) > 128 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
			return
		}
		if req.Result != "scheme" && req.Result != "fallback" {
			req.Result = "legacy"
		}
		if req.Source != "app" {
			req.Source = "web"
		}
		if err := s.St.RecordBuyClick(kind, req.VisitorID, req.Result, req.Source); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

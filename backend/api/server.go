// Package api：拾音业务轻服务 HTTP 面。
//
// 端点职责（方案 doc/plans/self-hosted-music-server.md §七）：
//   - GET /latest   App 升级通道：{version,url,note,releases[≤30]}，全空 404
//                   （客户端静默跳过）；CORS 开放供官网跨域读「当前版本」。
//                   永不设版本门槛（版本过低的客户端恰靠它获知升级地址）。
//   - GET /dash     看板页：服务端代理 license-platform /srv/dash
//                   （X-Product + X-Product-Token 鉴权），浏览器经 ?token= 访问。
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
	"os"
	"path/filepath"
	"strings"
	"time"

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
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	// JSON 端点一律 no-store：/latest（升级触达时效）与 /dash（看板时效+带 token）
	// 不允许被任何中间层缓存（2026-10-26 审查 I-2）
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Handler 装配全部路由。
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	mux.HandleFunc("GET /latest", s.handleLatest)
	mux.HandleFunc("GET /dash", s.handleDash)
	mux.Handle("/", s.staticHandler())
	return logMiddleware(mux)
}

// handleLatest 升级通道（发布唯一数据源 app_releases 表首=最新；全空 404）。
// 无版本门槛、无鉴权——与净屏 handleLatest 同构；response shape 变更须同步
// App 批1 更新检查实现与官网 download 页两处消费方。
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
	writeJSON(w, http.StatusOK, map[string]any{
		"version": latest.Version, "url": latest.URL, "note": latest.Note,
		"releases": rels,
	})
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

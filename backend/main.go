// 拾音业务轻服务（方案 doc/plans/self-hosted-music-server.md §三#14）：
// 官网静态页 + /latest 升级通道 + 看板页代理；不含发卡/支付（走 license-platform
// 发码体系）。单二进制 + SQLite，同构净屏 backend 模式；部署只绑内网
// 172.20.0.x，公网经 nginx-gateway 拾音专用 server block（回源白名单）。
package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"shiyin/backend/api"
	"shiyin/backend/store"
)

const usage = `拾音业务轻服务

  serve        启动 HTTP 服务（官网静态页 + /latest + /dash）
  latest-set   发布/修正一条版本记录（/latest 数据源；重复版本号=修正 url/note）

serve 参数：
  -addr          监听地址（默认 172.20.0.1:8090；只绑内网，公网经网关）
  -db            SQLite 路径（默认 shiyin.db）
  -web           官网静态页目录（默认 ./web）
  -platform-base license-platform 内网基址（默认 http://172.20.0.1:8080）
  -srv-token     平台 srv API 凭证（X-Product-Token，platform-admin srv-token-set 输出；空=/dash 503）
  -dash-token    看板页访问令牌（空=隐藏 /dash 入口）

latest-set 参数：-db -version -url -note
`

func main() {
	if len(os.Args) < 2 {
		fmt.Print(usage)
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "serve":
		err = cmdServe(os.Args[2:])
	case "latest-set":
		err = cmdLatestSet(os.Args[2:])
	default:
		fmt.Print(usage)
		os.Exit(2)
	}
	if err != nil {
		if errors.Is(err, store.ErrInvalidRelease) {
			fmt.Fprintln(os.Stderr, "参数不合法:", err)
			os.Exit(1)
		}
		log.Fatal(err)
	}
}

func cmdServe(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", "172.20.0.1:8090", "监听地址（只绑内网）")
	dbPath := fs.String("db", "shiyin.db", "SQLite 路径")
	webDir := fs.String("web", "./web", "官网静态页目录")
	platformBase := fs.String("platform-base", "http://172.20.0.1:8080", "license-platform 内网基址")
	srvToken := fs.String("srv-token", os.Getenv("SHIYIN_SRV_TOKEN"), "平台 srv API 凭证")
	dashToken := fs.String("dash-token", os.Getenv("SHIYIN_DASH_TOKEN"), "看板页访问令牌")
	if err := fs.Parse(args); err != nil {
		return err
	}
	st, err := store.Open(*dbPath)
	if err != nil {
		return err
	}
	defer st.Close()
	srv := &api.Server{
		St: st, PlatformBase: *platformBase, SrvToken: *srvToken,
		DashToken: *dashToken, WebDir: *webDir,
	}
	log.Printf("拾音轻服务启动 addr=%s web=%s", *addr, *webDir)
	// 显式超时防慢连接堆积（2026-10-26 审查 S-8；只绑内网，读头/空闲超时足够）
	hs := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	return hs.ListenAndServe()
}

func cmdLatestSet(args []string) error {
	fs := flag.NewFlagSet("latest-set", flag.ExitOnError)
	dbPath := fs.String("db", "shiyin.db", "SQLite 路径")
	version := fs.String("version", "", "版本号（如 1.0.0）")
	url := fs.String("url", "", "APK 下载地址（必须 https）")
	note := fs.String("note", "", "更新说明（≤4000 字节）")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *version == "" || *url == "" {
		return errors.New("latest-set: -version 与 -url 必填")
	}
	st, err := store.Open(*dbPath)
	if err != nil {
		return err
	}
	defer st.Close()
	if err := st.PublishRelease(*version, *url, *note, 0); err != nil {
		return err
	}
	rels, err := st.ListReleases(1)
	if err != nil {
		return err
	}
	if len(rels) == 0 {
		return errors.New("latest-set: publish verified empty")
	}
	log.Printf("已发布：当前最新=%s %s", rels[0].Version, rels[0].URL)
	return nil
}

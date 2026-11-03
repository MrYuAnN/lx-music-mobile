// Package store：拾音业务轻服务 SQLite 数据层。
//
// 当前唯一数据域 = App 版本发布（app_releases），服务 /latest 更新通道与
// 官网下载页「当前版本」。对标净屏 backend releases 域（同构模式），按拾音
// 现状裁剪：无 meta 三键兼容层（净屏该层为老库迁移残留；拾音全新建库，
// 表即权威数据源，全空返回 404 由客户端静默跳过——方案 doc/plans/
// self-hosted-music-server.md §七）。后续若加运营域（订单/规则包）在此扩展。
package store

import (
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"

	osv "ordercore/orderstore"
)

// ErrInvalidRelease 发布参数不合法（版本号形态 / URL 非 https / 超长）。
var ErrInvalidRelease = errors.New("invalid release")

var releaseVerRe = regexp.MustCompile(`^\d+(\.\d+){0,3}$`)

// Release 一条版本发布记录。note 为平铺文本（App 弹窗/官网渲染共用）；展示端按
// 行前缀「新增：/修复：/优化：」分组（规则单源=App 端 src/utils/changelog.ts，
// 官网 download.html 同规则对拍；无前缀行归「更新」组，容错半角冒号）——
// 后端零解析零结构化（首版未引入净屏的 entries 结构化双字段，App「更新日志」页
// 需求以行前缀约定落地，/latest 契约向前兼容）。
type Release struct {
	Version    string `json:"version"`
	URL        string `json:"url"`
	Note       string `json:"note"`
	ReleasedAt int64  `json:"released_at"` // unix 秒
}

// Store 轻服务数据库句柄（单库单写者：服务进程 + latest-set CLI 不并发；
// WAL+单连接串行化不变量——批2 起订单域经 ordercore Domain 共用同一句柄，
// I-C 决策：禁双连接池）。
type Store struct {
	*osv.Domain
	db    *sql.DB
	skuMu sync.RWMutex
	skus  map[string]SKU
	// skuFetchedAt 最近一次平台 /srv 全量拉取成功时间（unix 秒；skuMu 保护，与
	// skus 同锁写）——SWR 顺手刷新判龄用（2026-11-03 拍板，见 RefreshSKUsStaleAsync）
	skuFetchedAt int64
	// skuTriggerMu/skuTriggeredAt SWR 触发防抖（独立小锁；与缓存锁分离避免锁序纠缠）
	skuTriggerMu   sync.Mutex
	skuTriggeredAt int64
}

// Open 打开（不存在则建）数据库并跑迁移。
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db, skus: map[string]SKU{}}
	s.Domain = osv.NewDomain(db, s, shiyinOrderCfg)
	s.Domain.AppCN = AppCN
	s.Domain.TierCN = TierCN
	// Audit 缝不装配（nil）：mock/manual 模式无渠道回调路径，markPaid 复活审计
	// 不触发（AdminConfirmPaid 走自有事务不含审计——与净屏行为一致）。
	// trial_sync 游标记账缝=本地 meta 表。
	s.Domain.MetaGet = s.metaGet
	s.Domain.MetaSet = s.metaSet
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS app_releases(
		version TEXT PRIMARY KEY,
		url TEXT NOT NULL,
		note TEXT NOT NULL DEFAULT '',
		released_at INTEGER NOT NULL
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS meta(
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	// F-09（批5）：闲鱼归因点击埋点（净屏 site_buy_clicks 同构——kind/visitor_id/at
	// 基础列+result/source 两列照净屏 003 终态一步到位）。fire-and-forget 上报，
	// 失败静默不阻断唤端主链路
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS site_buy_clicks(
		kind TEXT NOT NULL,
		visitor_id TEXT NOT NULL,
		at INTEGER NOT NULL,
		result TEXT NOT NULL DEFAULT 'legacy',
		source TEXT NOT NULL DEFAULT 'web'
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	// 官网浏览/下载埋点（看板补齐批 2026-11-03，净屏 001+004/006/007 终态一步
	// 到位——拾音全新建库无存量行，is_bot 可空三态仅为对齐净屏聚合口径语义）。
	// 索引照净屏 001 终态（visitor/at 双索引——SiteStats 与突发指纹回扫全系
	// 查询走 at 窗扫、去重走 visitor）；存量 site_buy_clicks 补净屏同款 (kind,at)
	// 索引（F-09 建表时缺，看板补齐审查 S-5 顺手补齐）
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS site_visits(
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		visitor_id TEXT NOT NULL,
		page TEXT NOT NULL,
		ip TEXT NOT NULL DEFAULT '',
		at INTEGER NOT NULL,
		ua TEXT NOT NULL DEFAULT '',
		is_bot INTEGER,
		referer TEXT NOT NULL DEFAULT '',
		channel TEXT NOT NULL DEFAULT ''
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS site_downloads(
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		visitor_id TEXT NOT NULL,
		at INTEGER NOT NULL
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	for _, idx := range []string{
		`CREATE INDEX IF NOT EXISTS idx_site_visits_visitor ON site_visits(visitor_id, at)`,
		`CREATE INDEX IF NOT EXISTS idx_site_visits_at ON site_visits(at)`,
		`CREATE INDEX IF NOT EXISTS idx_site_downloads_visitor ON site_downloads(visitor_id, at)`,
		`CREATE INDEX IF NOT EXISTS idx_site_downloads_at ON site_downloads(at)`,
		`CREATE INDEX IF NOT EXISTS idx_buy_clicks_kind ON site_buy_clicks(kind, at)`,
	} {
		if _, err := db.Exec(idx); err != nil {
			db.Close()
			return nil, fmt.Errorf("migrate: %w", err)
		}
	}
	// ordercore 订单域迁移（独立记账 ordercore_migrations；拾音新库按序执行
	// 0001/0002 建终态 orders——批2 首启即建，无基线分支）
	if err := s.Domain.Migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("order migrate: %w", err)
	}
	return s, nil
}

// metaGet/metaSet meta 表读写（Domain.MetaGet/MetaSet 缝落点；Setting 运营
// 配置与 trial_sync 游标共用本表）。
func (s *Store) metaGet(key string) string {
	var v string
	_ = s.db.QueryRow(`SELECT value FROM meta WHERE key=?`, key).Scan(&v)
	return v
}

func (s *Store) metaSet(key, val string) error {
	_, err := s.db.Exec(`INSERT INTO meta(key,value) VALUES(?,?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, val)
	return err
}

// MetaGet/MetaSet 导出面（批2 panel cfg 分区与诊断用；缝同名直通）。
func (s *Store) MetaGet(key string) string     { return s.metaGet(key) }
func (s *Store) MetaSet(key, val string) error { return s.metaSet(key, val) }

// Close 关闭底层句柄。
func (s *Store) Close() error { return s.db.Close() }

// DB 底层句柄（测试用；批2 回归测试回填订单时刻需要）。
func (s *Store) DB() *sql.DB { return s.db }

// PublishRelease 发布/修正一条版本记录（最新版指针语义=表首，released_at 倒序）：
//   - 新版本号：入库（releasedAt<=0 取当前时间）；
//   - 已存在版本：仅覆盖 url/note（「修正历史条目」语义，不动发布时间——
//     对标净屏 2026-09-02 审查 I-2：修正对升级通道零副作用）。
//
// 版本回滚 = 显式发布旧版本号入表后手工调整（无 meta 指针，首条即最新），
// 灰度规模下接受手工。
func (s *Store) PublishRelease(version, url, note string, releasedAt int64) error {
	if !releaseVerRe.MatchString(version) || len(version) > 32 ||
		!strings.HasPrefix(url, "https://") || len(url) > 512 || len(note) > 4000 {
		return ErrInvalidRelease
	}
	if releasedAt <= 0 {
		releasedAt = time.Now().Unix()
	}
	_, err := s.db.Exec(`INSERT INTO app_releases(version,url,note,released_at) VALUES(?,?,?,?)
		ON CONFLICT(version) DO UPDATE SET url=excluded.url, note=excluded.note`,
		version, url, note, releasedAt)
	return err
}

// ListReleases 发布历史（released_at 倒序、同秒按插入序；TEXT 版本号不可作
// 排序键——"1.5.9">"1.5.10" 字符串序陷阱，同净屏 2026-09-02 审查 I-1）。
// limit<=0 = 全量；空表返回空 slice（/latest 据此 404）。
func (s *Store) ListReleases(limit int) ([]Release, error) {
	q := `SELECT version,url,note,released_at FROM app_releases ORDER BY released_at DESC, rowid DESC`
	if limit > 0 {
		q += fmt.Sprintf(" LIMIT %d", limit)
	}
	rows, err := s.db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Release{}
	for rows.Next() {
		var r Release
		if err := rows.Scan(&r.Version, &r.URL, &r.Note, &r.ReleasedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// RecordBuyClick 闲鱼归因点击埋点（F-09 批5，净屏 store/site.go 同语义）：result=
// 唤端结果（scheme/fallback/legacy，白名单校验在 API 层，此处兜底归一）；kind 路径
// 即语义（xianyu）。上报方 fire-and-forget 失败静默，本层错误仅日志面。
func (s *Store) RecordBuyClick(kind, vid, result, source string) error {
	if vid == "" {
		return nil
	}
	if result == "" {
		result = "legacy"
	}
	if source == "" {
		source = "web"
	}
	_, err := s.db.Exec(`INSERT INTO site_buy_clicks(kind,visitor_id,at,result,source) VALUES(?,?,?,?,?)`,
		kind, vid, time.Now().Unix(), result, source)
	return err
}

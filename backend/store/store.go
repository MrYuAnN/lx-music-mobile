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
	"time"

	_ "modernc.org/sqlite"
)

// ErrInvalidRelease 发布参数不合法（版本号形态 / URL 非 https / 超长）。
var ErrInvalidRelease = errors.New("invalid release")

var releaseVerRe = regexp.MustCompile(`^\d+(\.\d+){0,3}$`)

// Release 一条版本发布记录。note 为平铺文本（App 弹窗/官网渲染共用）；
// 首版未引入净屏的 entries 结构化双字段（App「更新日志」页需求出现时按
// 净屏 008 迁移模式加列，/latest 契约向前兼容）。
type Release struct {
	Version    string `json:"version"`
	URL        string `json:"url"`
	Note       string `json:"note"`
	ReleasedAt int64  `json:"released_at"` // unix 秒
}

// Store 轻服务数据库句柄（单库单写者：服务进程 + latest-set CLI 不并发，
// SQLite 默认串行即可；WAL 打开以容忍官网页读、CLI 写的偶发交错）。
type Store struct {
	db *sql.DB
}

// Open 打开（不存在则建）数据库并跑迁移。
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS app_releases(
		version TEXT PRIMARY KEY,
		url TEXT NOT NULL,
		note TEXT NOT NULL DEFAULT '',
		released_at INTEGER NOT NULL
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

// Close 关闭底层句柄。
func (s *Store) Close() error { return s.db.Close() }

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

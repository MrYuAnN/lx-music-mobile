package store

import (
	"path/filepath"
	"testing"
	"time"
)

// RefreshSKUsStaleAsync SWR 顺手刷新单测（2026-11-03 拍板）：判龄/防抖两段逻辑——
// 缓存新不占触发位；超龄首调触发、防抖窗内二调不重占、窗外重占。SRVClient 未注入
// 时 RefreshSKUsQuiet 安全失败仅日志（ErrSrvUnavailable），不影响触发位断言。
func TestRefreshSKUsStaleAsync(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "swr-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.db.Close()

	// 缓存新（刚拉到）→ 不占触发位、不触发
	st.skuMu.Lock()
	st.skuFetchedAt = time.Now().Unix()
	st.skuMu.Unlock()
	st.RefreshSKUsStaleAsync(30*time.Second, 30*time.Second)
	if st.skuTriggeredAt != 0 {
		t.Fatal("缓存新不应占触发位")
	}

	// 伪造超龄缓存 → 首调占触发位+后台触发
	st.skuMu.Lock()
	st.skuFetchedAt = time.Now().Add(-10 * time.Minute).Unix()
	st.skuMu.Unlock()
	st.RefreshSKUsStaleAsync(30*time.Second, 30*time.Second)
	first := st.skuTriggeredAt
	if first == 0 {
		t.Fatal("超龄首调应占触发位")
	}

	// 防抖窗内二调 → 触发位不变
	st.RefreshSKUsStaleAsync(30*time.Second, 30*time.Second)
	if st.skuTriggeredAt != first {
		t.Fatal("防抖窗内二调不应重占触发位")
	}

	// 防抖窗外（触发时间已老）→ 重新占位触发（基准=手动设置的老值——秒级精度下
	// first 可能与新占位同秒，断言必须对老值比）
	st.skuTriggerMu.Lock()
	stale := time.Now().Add(-time.Minute).Unix()
	st.skuTriggeredAt = stale
	st.skuTriggerMu.Unlock()
	st.RefreshSKUsStaleAsync(30*time.Second, 30*time.Second)
	if st.skuTriggeredAt == stale {
		t.Fatal("防抖窗外应重新占触发位")
	}
}

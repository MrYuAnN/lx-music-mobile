// Package cron 拾音后端后台 loop（批2；净屏 cron.go 对照精简）：
// SKU 缓存刷新（5min）/试用补单（10min，启动即跑一轮）/paid 补发+48h 关单
// （15min）。裁剪声明：支付通道查单对账不注册（拍板人工闲鱼链路无通道——
// ordercore Reconcile 语义在 manual 形态天然兼容，通道查单分支无对象）；
// 例行清理/规则包/告警 loop 属净屏域不随迁。
package cron

import (
	"context"
	"log"
	"time"

	"shiyin/backend/store"
)

// Start 挂载拾音后端三条后台 loop（ctx 取消即全部退出；main 装配）。
func Start(ctx context.Context, st *store.Store) {
	go skuRefreshLoop(ctx, st)
	go trialSyncLoop(ctx, st)
	go reconcileLoop(ctx, st)
}

// skuRefreshLoop 每 5 分钟刷新平台 SKU 缓存（srv 不可达保留旧值）。
func skuRefreshLoop(ctx context.Context, st *store.Store) {
	t := time.NewTicker(5 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			st.RefreshSKUsQuiet()
		}
	}
}

// trialSyncLoop 试用免费单补单（拾音 auto3 首启试用；runbook shiyin-auto3）：
// 启动即跑一次（空转无害），此后 10 分钟一轮。即时回调路（平台 claim → panel
// action trial_order_create）双保险，缺一路 10min 内收敛。
func trialSyncLoop(ctx context.Context, st *store.Store) {
	SyncTrialOrders(st)
	t := time.NewTicker(10 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			SyncTrialOrders(st)
		}
	}
}

// SyncTrialOrders 试用补单单轮（失败仅日志，下轮从游标续拉——游标缝=meta 表）。
func SyncTrialOrders(st *store.Store) {
	n, err := st.SyncTrialOrders()
	if err != nil {
		log.Printf("[CRON] trial sync: %v (created=%d, will retry from cursor)", err, n)
		return
	}
	if n > 0 {
		log.Printf("[CRON] trial sync created %d orders", n)
	}
}

// reconcileLoop 15 分钟一轮：paid 补发+48h 关单（无通道查单分支——人工链路）。
func reconcileLoop(ctx context.Context, st *store.Store) {
	t := time.NewTicker(15 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			Reconcile(st)
		}
	}
}

// Reconcile 已支付未发货补发（池空订单停留 paid 由本 loop 重试——SettleOrder
// 幂等：markPaid 真幂等跳过+deliver 重划回显）+48h 未付款 pending 自动关单
// （timeout_close 事件，订单中心据此分文案）。
func Reconcile(st *store.Store) {
	paid, err := st.PaidUndelivered()
	if err != nil {
		log.Printf("[CRON] paid query: %v", err)
	}
	for _, o := range paid {
		if _, err := st.SettleOrder(o.OrderNo, o.TradeNo, o.Amount); err != nil {
			log.Printf("[ALERT] deliver retry %s: %v", o.OrderNo, err)
		} else {
			log.Printf("[CRON] delivered %s on retry", o.OrderNo)
		}
	}
	if n, err := st.CloseExpiredPending(time.Now().Add(-48 * time.Hour).Unix()); err != nil {
		log.Printf("[CRON] close expired pending: %v", err)
	} else if n > 0 {
		log.Printf("[CRON] closed %d expired pending orders", n)
	}
}

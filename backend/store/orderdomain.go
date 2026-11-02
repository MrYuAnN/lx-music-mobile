// orderdomain.go 拾音订单域接线（批2，方案 doc/plans/shiyin-order-domain.md §四批2）：
// Store 组合嵌入 ordercore Domain（订单方法面提升），产品参数经 shiyinOrderCfg
// 注入；SKU 缓存（平台 /srv/skus 单源+下单 miss 兜底实时拉）与运营 settings
// （meta 表 KV，panel cfg 分区 config_set 写入面）本文件承载。
package store

import (
	"log"

	osv "ordercore/orderstore"
	"ordercore/srv"
)

// shiyinOrderCfg 拾音订单域产品参数（ordercore 单源注入；值=批2 接线拍板——
// 单号前缀 SY/SYTRIAL- 与净屏 JP/JPTRIAL- 区分，试用 SKU=runbook 已建
// shiyin-auto3（3 天 dl2）。
// 组合禁入档位=产品自有规则（批3 用户拍板推翻批2「净屏同款」照抄：d7 是拾音
// 主售档，须可参与组合；trial7/trial3 为净屏 trial 档名，拾音无此档留着无害，
// auto3 体验档保留禁入——试用额度不应被组合购入套走）。
// 金额/标签/文案纪律与净屏逐项对齐：金额统计禁实时 JOIN 当前价（快照单源）。
var shiyinOrderCfg = osv.Config{
	ProductID:            "shiyin",
	OrderNoPrefix:        "SY",
	TrialOrderPrefix:     "SYTRIAL-",
	TrialSKU:             "auto3",
	TrialTag:             "自动试用",
	TrialDesc:            "免费试用(3天)",
	TrialCreateDesc:      "自动试用发放（首启免费试用 3 天）",
	FreeTags:             []string{"送人", "活动赠送"},
	ComboRestrictedTiers: []string{"trial7", "trial3", "auto3"},
}

// AppCN 拾音受管 app 的 key→中文名（描述快照数据源；product_apps 注册表拾音行
// display_name 对齐——2026-11-03 补齐 tx/wy/kg/kw 四条（此前缺项回落原值，
// tx 系订单快照/管理台/App 卡片显示「tx·7天」，客诉实锤）。上架新 App 时此处
// 与平台注册表须同步补条目。TierCN 档位中文（平台 seed 默认档全集+auto3）。
var (
	AppCN  = map[string]string{"shiyin": "拾音", "tx": "QQ音乐", "wy": "网易云音乐", "kg": "酷狗音乐", "kw": "酷我音乐"}
	TierCN = map[string]string{"d7": "7天", "m1": "月卡", "m6": "半年卡", "y1": "年卡", "perm": "永久", "auto3": "体验·3天"}
)

// SetSRV 注入平台 srv 客户端（main 装配；token=现有 SHIYIN_SRV_TOKEN 复用——
// 批2 方案 I-B 红线：禁跑 srv-token-set 签发（取链/轻服务两处在用=吊销）。
func (s *Store) SetSRV(c *srv.Client) { s.Domain.SetSRVClient(c) }

// SRV 取平台 srv 客户端（api/panel 用）。
func (s *Store) SRV() *srv.Client { return s.Domain.SRVClient() }

// TrialOrderPrefix 拾音试用单号前缀（api 层 uid 视图豁免判定锚，七题回归反馈
// 2026-11-02：试用单交付码对 uid 弱凭证视图豁免脱敏——正式单脱敏契约不变）。
func (s *Store) TrialOrderPrefix() string { return shiyinOrderCfg.TrialOrderPrefix }

// ---------- SKU 缓存（平台 /srv/skus 单源；净屏同构模式） ----------

// RefreshSKUs 拉取平台全量 SKU 刷新本地缓存（启动 seed / cron 定时 / 下单 miss
// 兜底实时拉共用）。平台 srv 不可达时返回错误且保留旧缓存（下单链路用旧值，
// 与「离线宽限」同精神；deliver 仍以平台实时校验为准）。
func (s *Store) RefreshSKUs() error {
	sc := s.Domain.SRVClient()
	if sc == nil {
		return ErrSrvUnavailable
	}
	list, err := sc.SKUs()
	if err != nil {
		return err
	}
	m := make(map[string]SKU, len(list))
	for _, sk := range list {
		m[sk.ID] = osv.FromSrv(sk)
	}
	s.skuMu.Lock()
	s.skus = m
	s.skuMu.Unlock()
	return nil
}

// RefreshSKUsQuiet 静默刷新（后台任务用：失败仅日志不中断；日志通道统一
// log.Printf——批2 代码审 S6）。
func (s *Store) RefreshSKUsQuiet() {
	if err := s.RefreshSKUs(); err != nil {
		log.Printf("[SRV] sku refresh failed (keep stale cache): %v", err)
	}
}

// SKUsView sku 缓存快照列表（排序；panel 新建订单表单下拉数据源）。
func (s *Store) SKUsView() []SKU {
	snap := s.SnapshotSkus()
	out := make([]SKU, 0, len(snap))
	for _, sk := range snap {
		out = append(out, sk)
	}
	osv.SortSKUsByID(out)
	return out
}

// SnapshotSkus 缓存快照（读锁拷贝；ordercore SKUSource 接口面）。
func (s *Store) SnapshotSkus() map[string]SKU {
	s.skuMu.RLock()
	defer s.skuMu.RUnlock()
	out := make(map[string]SKU, len(s.skus))
	for k, v := range s.skus {
		out[k] = v
	}
	return out
}

// GetSKU 本地缓存取 SKU；miss 时兜底实时拉一次（冷启动/新上架）。
func (s *Store) GetSKU(id string) (SKU, error) {
	if sk, ok := s.SnapshotSkus()[id]; ok {
		return sk, nil
	}
	s.RefreshSKUsQuiet()
	if sk, ok := s.SnapshotSkus()[id]; ok {
		return sk, nil
	}
	return SKU{}, osv.ErrSkuNotFound
}

// ListSKUs 本地缓存全量（enabledOnly=选购页口径；按 id 字典序稳定输出）。
func (s *Store) ListSKUs(enabledOnly bool) ([]SKU, error) {
	snap := s.SnapshotSkus()
	out := make([]SKU, 0, len(snap))
	for _, sk := range snap {
		if enabledOnly && !sk.Enabled {
			continue
		}
		out = append(out, sk)
	}
	osv.SortSKUsByID(out)
	return out, nil
}

// ResolveCombo 本地组合解析（数据=缓存；规则=ordercore 单源，禁入档位经
// shiyinOrderCfg 注入）。单 App 形态下任意两段组合被 dup-app 规则拒绝
// （与平台/净屏同构规则）——机制在位，跨 App 场景出现即自动可用。
func (s *Store) ResolveCombo(sku string) ([]ComboItem, error) {
	return osv.ResolveComboIn(shiyinOrderCfg, s.SnapshotSkus(), sku)
}

// ChannelLabel 渠道展示文案（单源 ordercore ChannelLabel+拾音 cfg；panel 订单表
// 与明细弹窗共用）。
func ChannelLabel(channel, tag string) string {
	return osv.ChannelLabel(shiyinOrderCfg, channel, tag)
}

// OrderNoPrefix 拾音订单号前缀（panel global_search 主键直查判定用）。
func OrderNoPrefix() string { return shiyinOrderCfg.OrderNoPrefix }

// PendingDeliveryCount 已支付未发货计数（订单分区 badge；轻量单查不经
// OrderSalesStats 六查询）。DB 故障 log 留痕返回 0（批2 代码审 S5：静默伪 0
// 误导运营——留痕后保守降级，面板主表不受影响）。
func (s *Store) PendingDeliveryCount() int {
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(1) FROM orders WHERE status='paid' AND is_test=0`).Scan(&n); err != nil {
		log.Printf("[PANEL] pending delivery count: %v", err)
		return 0
	}
	return n
}

// ---------- 运营 settings（meta 表 KV；panel cfg 分区 config_set 写入面） ----------

// Setting 读运营配置（meta 表；缺省空串）。键集（批2 cfg 分区）：
// xianyu_item_url（闲鱼淘口令短链，resolver 输入）/ contact_url（客服链接）/
// service_hours（客服时段文案）/ native_checkout（=1 开 App 原生下单通道）。
func (s *Store) Setting(key string) string {
	return s.MetaGet(key)
}

// SettingSet 写运营配置（upsert；panel cfg 分区 config_set action 落点）。
func (s *Store) SettingSet(key, val string) error {
	return s.MetaSet(key, val)
}

// SKU/ComboItem/errors 类型门面（api/panel 调用面用 store 前缀，域单源 ordercore）。
type (
	SKU       = osv.SKU
	ComboItem = osv.ComboItem
)

// ErrSrvUnavailable 平台 srv 不可用（SKU 缓存刷新/划码通道；单源 ordercore）。
var ErrSrvUnavailable = osv.ErrSrvUnavailable

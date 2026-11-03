// Package admin 拾音业务面板（批2，方案 doc/plans/shiyin-order-domain.md §四批2）：
// /panel/{summary,action,query} 三端点，X-Panel-Token 服务间鉴权（token 空=不
// 注册路由）；平台管理台「业务面板」tab 经 /admin/api/panel?product=shiyin 代理
// 到本接口（products 注册表 panel_url/panel_token 驱动）。
//
// 拾音装配范围（方案 I-E 裁剪拍板+看板补齐批 2026-11-03 扩展）：
//   - 分区=看板（销售 4 卡+转化漏斗 4 对 8 卡：浏览/下载/试用/购买，卡序=净屏
//     10-13 拍板漏斗序、卡 id 与净屏同名单源）/订单（仅 ordersTbl——裁净屏
//     channelTbl 净屏官网链接表与 legacy_replay 净屏存量回放；rulepack_content
//     类规则域不存在）/设置（cfg 精简分区：xianyu_item_url/contact_url/
//     service_hours/native_checkout）
//   - query kinds=orders/order_codes/global_search/dash_metric（sales_today/
//     sales_total/trial/visit_today/visit_total/download/buy）/trial_order 相关
//     子集（白名单仍用 ordercore/panel 全量单源；未开放 kind 显式报「本产品未提供」）
//   - actions=confirm_paid/order_test_toggle/order_cancel/manual_order_create/
//     code_return/code_void/order_settag/order_edit_amount/trial_order_create/cfg_save
//
// 契约=净屏 panel_schema v2 同构（section/card/tbl/frm 构造器键名一致，bp.js 壳
// 通用渲染）；与净屏实现双源运行（净屏 panel 订单段未来上收 ordercore 挂账批4），
// 漂移防线=query kinds 单源+契约动线由壳保证。
package admin

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	osv "ordercore/orderstore"
	orderpanel "ordercore/panel"
	"ordercore/srv"

	"shiyin/backend/store"
)

// PanelServer 业务面板运行时依赖（Token 空=面板接口整体关闭）。
type PanelServer struct {
	St    *store.Store
	Token string

	// dashMu/dashCache/dashAt 平台 /srv/dash 双层缓存（看板补齐批 2026-11-03，
	// 净屏 dashWithCache 同款：30s 新鲜窗+失败沿用 ≤5min 旧值+无旧值报错——
	// summary 高频刷新不逐次阻塞外呼，试用卡值/亮黄信号取此处）
	dashMu    sync.Mutex
	dashCache *srv.Dash
	dashAt    time.Time
}

// dashWithCache 平台 /srv/dash 结果 30s 进程内缓存（净屏同款双层窗）：失败沿用
// ≤5 分钟内的旧值（防长期陈旧），无旧值如实返回错误（试用对卡整对不渲染，
// 不造 0 值假卡——净屏拍板卡面静默降级语义）。
func (ps *PanelServer) dashWithCache() (*srv.Dash, error) {
	ps.dashMu.Lock()
	defer ps.dashMu.Unlock()
	if ps.dashCache != nil && time.Since(ps.dashAt) < 30*time.Second {
		return ps.dashCache, nil
	}
	sc := ps.St.SRV()
	if sc == nil {
		return nil, errors.New("srv client not configured")
	}
	d, err := sc.Dash()
	if err != nil {
		if ps.dashCache != nil && time.Since(ps.dashAt) < 5*time.Minute {
			return ps.dashCache, nil
		}
		return nil, err
	}
	ps.dashCache, ps.dashAt = d, time.Now()
	return d, nil
}

// ---------- schema 构造器（净屏 panel_schema.go 同构；键名字面量收敛于此） ----------

func section(id, title string) map[string]any {
	return map[string]any{"id": id, "title": title}
}

func card(id, label, value string, warn bool, detail map[string]any) map[string]any {
	m := map[string]any{"id": id, "label": label, "value": value, "warn": warn}
	if detail != nil {
		m["detail"] = detail
	}
	return m
}

func tbl(id, title string, cols []string, rows [][]string) map[string]any {
	return map[string]any{"id": id, "title": title, "cols": cols, "rows": rows}
}

func frm(id, title, submit string) map[string]any {
	return map[string]any{"id": id, "title": title, "submit": submit}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func errJSON(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// RegisterPanelRoutes 挂载 /panel/*（token 空=不注册；鉴权=恒时比较——批1 代码
// 审 S3：拾音新面直接采用平台 srv 同款基线，不继承净屏弱比较）。
func RegisterPanelRoutes(mux *http.ServeMux, ps *PanelServer) {
	if ps == nil || ps.Token == "" {
		return
	}
	auth := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			tok := r.Header.Get("X-Panel-Token")
			if tok == "" || !orderpanel.TokenEqual(tok, ps.Token) {
				errJSON(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			h(w, r)
		}
	}
	mux.HandleFunc("GET /panel/summary", auth(ps.handleSummary))
	mux.HandleFunc("POST /panel/action", auth(ps.handleAction))
	mux.HandleFunc("GET /panel/query", auth(ps.handleQuery))
}

// ---------- summary ----------

func (ps *PanelServer) handleSummary(w http.ResponseWriter, _ *http.Request) {
	sections := []map[string]any{ps.dashSection(), ps.ordersSection(), ps.cfgSection()}
	writeJSON(w, http.StatusOK, map[string]any{"registered": true, "sections": sections})
}

// dashSection 看板分区（看板补齐批 2026-11-03：销售 4 卡+转化漏斗 4 对 8 卡，
// 卡序=净屏 2026-10-13 拍板漏斗序（浏览→下载→试用→购买）；卡 id 与净屏同名
// 单源——平台壳 bp.js ORDER 硬编码数组按 id 排序，卡 id ≠ 明细 metric 名
// （浏览卡 id=pv_*、metric=visit_*，净屏先例同构））。trial 卡值/亮黄=平台
// srv dash 双层缓存（dashWithCache；失败该对卡整体不渲染不造 0 值假卡）；
// 明细=TrialDetail 弹窗（平台流水+机型+待补单标记，existing query）。
func (ps *PanelServer) dashSection() map[string]any {
	sec := section("dash", "看板")
	os, err := ps.St.OrderSalesStats()
	if err != nil {
		sec["notice"] = "销售口径加载失败：" + err.Error()
		sec["cards"] = []map[string]any{}
		return sec
	}
	cny := func(c int) string { return "¥" + fmt.Sprintf("%.2f", float64(c)/100) }
	cards := []map[string]any{
		card("sales_today", "今日销售额", cny(os.TodaySalesCents), false,
			map[string]any{"kind": "dash_metric", "metric": "sales_today"}),
		card("sales_total", "累计销售额", cny(os.TotalSalesCents)+"（实收 "+cny(os.ActualSalesCents)+"）", false,
			map[string]any{"kind": "dash_metric", "metric": "sales_total"}),
		card("today_orders", "今日付款订单", strconv.Itoa(os.TodayPaidOrders), false, nil),
		card("pending_delivery", "已支付未发货", strconv.Itoa(os.PendingDelivery), os.PendingDelivery > 0, nil),
	}
	// ---------- 转化漏斗 4 对 8 卡（净屏 panel_sections.go 同构，值=今日、
	// 累计成对独立卡；各数据源失败静默跳过该对卡——卡面高频展示不整卡报错，
	// 明细弹窗低频如实报错，净屏拍板双策略） ----------
	// 浏览 PV/UV（Store.SiteStats 真人/原始双口径；label 注记随站长名单联动，
	// 净屏 10-16 拍板：未配置恒「已剔爬虫」，配置后「已剔爬虫与站长」）
	if st, err := ps.St.SiteStats(); err == nil {
		pvNote := "已剔爬虫"
		if len(ps.St.OwnerVids()) > 0 {
			pvNote = "已剔爬虫与站长"
		}
		cards = append(cards,
			card("pv_today", "今日浏览·"+pvNote+"（真人 UV "+strconv.FormatInt(st.UvTodayHuman, 10)+
				" / 原始 "+strconv.FormatInt(st.PvTodayRaw, 10)+"）", strconv.FormatInt(st.UvTodayHuman, 10), false,
				map[string]any{"kind": "dash_metric", "metric": "visit_today"}),
			card("pv_total", "累计浏览·"+pvNote+"（真人 UV "+strconv.FormatInt(st.UvTotalHuman, 10)+
				" / 原始 "+strconv.FormatInt(st.PvTotalRaw, 10)+"）", strconv.FormatInt(st.UvTotalHuman, 10), false,
				map[string]any{"kind": "dash_metric", "metric": "visit_total"}))
	}
	// 下载点击（官网按钮 beacon 单一来源，B 方案防双计——净屏拍板）
	if cl, un, err := ps.St.DownloadStats("today"); err == nil {
		cards = append(cards, card("download_today", "今日下载点击·官网（去重 "+strconv.FormatInt(un, 10)+"）",
			strconv.FormatInt(cl, 10), false, map[string]any{"kind": "dash_metric", "metric": "download"}))
	}
	if cl, un, err := ps.St.DownloadStats("all"); err == nil {
		cards = append(cards, card("download_total", "累计下载点击·官网（去重 "+strconv.FormatInt(un, 10)+"）",
			strconv.FormatInt(cl, 10), false, map[string]any{"kind": "dash_metric", "metric": "download"}))
	}
	// 试用发放（值源=平台 srv dash Trial 汇总——TrialGrantsRecent 200 条上限
	// 不作卡值口径，S-7 弃选理由：本地补单单 COUNT 受补单分钟级延迟影响，srv
	// dash=发放即时真源。版本拒绝/IP 限>0 亮黄=门槛与发版失配信号（计数器已
	// per-product 化，2026-11-03 平台仓根治配套——混计假黄已消除））
	if pd, err := ps.dashWithCache(); err == nil {
		cards = append(cards,
			card("trial_today", "今日试用发放·命中返原码 "+strconv.FormatInt(pd.Trial.HitsToday, 10)+
				" / 版本拒绝 "+strconv.FormatInt(pd.Trial.Reject426, 10)+
				" / IP限 "+strconv.FormatInt(pd.Trial.RejectIP, 10),
				strconv.FormatInt(pd.Trial.ClaimsToday, 10), pd.Trial.Reject426 > 0 || pd.Trial.RejectIP > 0,
				map[string]any{"kind": "dash_metric", "metric": "trial"}),
			card("trial_total", "累计试用发放",
				strconv.FormatInt(pd.Trial.ClaimsTotal, 10), false,
				map[string]any{"kind": "dash_metric", "metric": "trial", "w": "all"}))
	}
	// 购买点击（/site/xianyu 埋点 F-09 已落地，恒 App 端上报——官网无购买按钮，
	// label 句式对照净屏「·含App端」适配为「·App 端」；shop 列恒 0 不展示）
	if xy, _, err := ps.St.BuyClickStats("today"); err == nil {
		cards = append(cards, card("buy_today", "今日购买点击·App 端（闲鱼 "+strconv.FormatInt(xy, 10)+"）",
			strconv.FormatInt(xy, 10), false, map[string]any{"kind": "dash_metric", "metric": "buy"}))
	}
	if xy, _, err := ps.St.BuyClickStats("all"); err == nil {
		cards = append(cards, card("buy_total", "累计购买点击·App 端（闲鱼 "+strconv.FormatInt(xy, 10)+"）",
			strconv.FormatInt(xy, 10), false, map[string]any{"kind": "dash_metric", "metric": "buy", "w": "all"}))
	}
	sec["cards"] = cards
	return sec
}

// ---------- 订单分区（净屏 ordersSection 对照；裁 channelTbl/legacy_replay） ----------

func (ps *PanelServer) ordersSection() map[string]any {
	orders, _, _ := ps.St.ListOrdersWindow("", "", "", "", "", 0, "", 200) // 默认视图排测试
	// 复填：最近手动单 SKU/数量/标签预填（净屏研究席 I1 同款动线）
	lastManual, _ := ps.St.LatestManualOrder()
	lastManualQty := "1"
	if lastManual.Qty > 0 && lastManual.Channel == "manual" {
		lastManualQty = strconv.Itoa(lastManual.Qty)
	} else {
		lastManual = osv.Order{}
	}
	// 标签筛选下拉=预设∪已用（预设单源=平台 PoolPresetTags 经 PresetTags 下发）
	tagOpts := []map[string]string{{"v": "", "label": "全部标签"}}
	tagSeen := map[string]bool{}
	for _, tg := range ps.St.PresetTags() {
		if tg != "" && !tagSeen[tg] {
			tagSeen[tg] = true
			tagOpts = append(tagOpts, map[string]string{"v": tg, "label": tg})
		}
	}
	if usedTags, errT := ps.St.UsedTags(); errT == nil {
		for _, tg := range usedTags {
			if tg != "" && !tagSeen[tg] {
				tagSeen[tg] = true
				tagOpts = append(tagOpts, map[string]string{"v": tg, "label": tg})
			}
		}
	}
	tagPreset := ps.St.PresetTags()
	skuOpts := []map[string]string{{"v": "", "label": "（选择 SKU）"}}
	for _, sk := range ps.St.SKUsView() {
		label := sk.Name + " ¥" + fmt.Sprintf("%.2f", float64(sk.PriceCents)/100)
		if !sk.Enabled {
			label += "（已下架）"
		}
		skuOpts = append(skuOpts, map[string]string{"v": sk.ID, "label": label})
	}

	ordersTbl := tbl("orders", "最近订单", orderPanelCols(), orderPanelRows(ps.adminOrderRows(orders)))
	ordersTbl["hint"] = "默认展示最近 200 条，更多请用搜索；测试单不计入看板金额/订单数统计；搜索支持订单号精确 / 手机号邮箱模糊 / 直接粘贴订单链接；筛选实时生效无需点按钮。"
	ordersTbl["rows_extra"] = ps.orderExtras(orders)
	ordersTbl["detail_actions"] = true
	ordersTbl["empty_hint"] = "无匹配订单（订单号需完整，手机号/邮箱支持模糊）。"
	ordersTbl["search"] = map[string]any{
		"query": "orders",
		"fields": []map[string]any{
			{"name": "q", "label": "订单号 / 手机号 / 邮箱 / 订单链接"},
			{"name": "status", "type": "select", "label": "状态",
				"options": []map[string]string{
					{"v": "", "label": "全部状态"}, {"v": "pending", "label": "pending"}, {"v": "paid", "label": "paid"}, {"v": "delivered", "label": "delivered"},
				}},
			// 类型预设（渠道×口径）；拾音渠道值域=manual/native（无 web 小店——
			// 「小店」筛选项裁掉，批1 代码审 S4 挂账确认项）
			{"name": "kind_filter", "type": "select", "label": "类型",
				"options": []map[string]string{
					{"v": "", "label": "全部（不含测试）"}, {"v": "app", "label": "App"},
					{"v": "xianyu", "label": "闲鱼"},
					{"v": "test", "label": "测试"},
				}},
			{"name": "otag", "type": "select", "label": "标签", "options": tagOpts},
			{"name": "window", "type": "select", "label": "时间窗",
				"options": []map[string]string{
					{"v": "", "label": "全部时间"}, {"v": "today", "label": "今日"},
					{"v": "7d", "label": "近7天"}, {"v": "30d", "label": "近30天"},
				}},
		},
	}
	ordersTbl["row_actions"] = []map[string]any{
		{"id": "order_detail", "label": "详情", "order_detail": true,
			"keys": []map[string]any{{"name": "order_no", "col": 0}}},
		{"id": "confirm_paid", "label": "确认收款", "amount_col": 4,
			"keys":    []map[string]any{{"name": "order_no", "col": 0}},
			"fields":  []map[string]any{{"name": "actual_cents", "label": "实收金额（元，默认=应收）", "type": "text", "unit": "yuan_to_cents", "default_col": 4}},
			"confirm": "确认已收到买家付款并发放激活码？（发错码可在订单行「详情」回池/作废补救）",
			"hide_when": []map[string]any{
				{"col": 3, "values": []string{"paid", "delivered", "closed"}}}},
		{"id": "codes", "label": "码管理", "codes_modal": true,
			"keys": []map[string]any{{"name": "order_no", "col": 0}},
			"hide_when": []map[string]any{
				{"col": 3, "values": []string{"pending", "paid"}}}},
		{"id": "order_test_toggle", "label": "标测试/取消",
			"keys":    []map[string]any{{"name": "order_no", "col": 0}},
			"confirm": "切换该单的测试标记？标记后默认列表不再显示（类型筛选选「测试」可查看与取消）；测试单不计销售额与订单数。"},
		{"id": "order_cancel", "label": "关闭", "danger": true,
			"keys":      []map[string]any{{"name": "order_no", "col": 0}},
			"confirm":   "确认关闭订单？关闭后买家无法再付款（仅待支付单可关）。",
			"hide_when": []map[string]any{{"col": 3, "values": []string{"paid", "delivered", "closed"}}}},
	}

	manualForm := frm("manual_order", "新建订单（闲鱼成交/送人/活动赠送/测试）", "建单并发码")
	manualForm["action_id"] = "manual_order_create"
	manualForm["modal"] = true
	manualForm["button"] = "＋ 新建订单"
	manualForm["notice"] = "提交即建单+划码并弹出激活码复制；金额可按议价实收填写；标签选「送人/活动赠送」自动金额归 0、不计销售额与订单数；测试单建单后点详情「标测试」；组合 SKU 数量须为 1。"
	manualForm["confirm"] = "请核对 SKU/数量/金额无误——提交即建单+划码并计入统计（送人/活动赠送自动标记非销售；可事后在订单行「详情」回池/作废补救）。"
	manualForm["fields"] = []map[string]any{
		{"name": "sku", "label": "SKU", "type": "select", "options": skuOpts, "value": lastManual.SKU},
		{"name": "qty", "label": "数量", "value": lastManualQty},
		{"name": "amount", "label": "实收金额（元）", "placeholder": "留空=SKU 目录价×数量"},
		{"name": "tag", "label": "用途标签（留空=未分类）", "type": "tags", "options": tagPreset, "value": lastManual.Tag},
		{"name": "contact", "label": "买家备注（闲鱼昵称/链接，可选，可搜索）"},
		// 防重 token：每次 summary 渲染生成，提交必随（双击/重放幂等回显原单）
		{"name": "form_token", "value": "mf-" + strconv.FormatInt(time.Now().UnixNano(), 10)},
	}

	sec := section("orders", "订单")
	sec["badge"] = ps.St.PendingDeliveryCount()
	sec["notice"] = "闲鱼成交/送人/测试发放：用「新建订单」一键建单+发码；App 内下单：确认收款发码。发码后点订单行「详情」可按码回池/作废补救（金额同步冲减；非销售单不计统计）。"
	sec["forms"] = []map[string]any{manualForm}
	sec["tables"] = []map[string]any{ordersTbl}
	return sec
}

// ---------- cfg 分区（批2 I-E：运营字段配置入口；净屏 cfg 分区拾音精简版） ----------

func (ps *PanelServer) cfgSection() map[string]any {
	sec := section("cfg", "设置")
	form := frm("config_set", "运营配置", "保存")
	form["action_id"] = "config_set"
	form["notice"] = "闲鱼链接填淘口令短链（m.tb.cn，后台自动解析 itemId 唤端直达商品页）；native_checkout 关闭即暂停 App 内下单入口（建单 409，已建订单不受影响）。"
	form["fields"] = []map[string]any{
		{"name": "xianyu_item_url", "label": "闲鱼商品链接（淘口令短链；支付引导页拉起目标）", "value": ps.St.Setting("xianyu_item_url")},
		{"name": "contact_url", "label": "客服链接（App 关于页「联系客服」读取）", "value": ps.St.Setting("contact_url")},
		{"name": "service_hours", "label": "客服时段文案", "value": ps.St.Setting("service_hours")},
		{"name": "combo_rates", "label": "组合折扣表 JSON（千分比；空=回退内置 8折/7.5折…；例 2个95折/3个9折/4个不折：[{\"n\":2,\"r\":950},{\"n\":3,\"r\":900},{\"n\":4,\"r\":1000}]）", "value": ps.St.Setting("combo_rates")},
		{"name": "native_checkout", "label": "开放 App 内下单（关=暂停下单通道，下单返回 409；应急开关）", "type": "checkbox", "value": ps.St.Setting("native_checkout") == "1"},
	}
	sec["forms"] = []map[string]any{form}
	return sec
}

// ---------- 订单行组装（净屏 panel.go 同构；desc 防 N+1 同 SKU 缓存） ----------

func orderPanelCols() []string {
	return []string{"订单号", "内容", "渠道", "状态", "金额", "联系方式", "激活码", "时间"}
}

// adminOrderRow 管理台订单行（Order+商品描述）。
type adminOrderRow struct {
	osv.Order
	Desc string `json:"desc"`
}

// adminOrderRows 批量附描述（同 SKU 描述去重缓存防 N+1；DescSnapshot 优先）。
func (ps *PanelServer) adminOrderRows(orders []osv.Order) []adminOrderRow {
	cache := map[string]string{}
	rows := make([]adminOrderRow, 0, len(orders))
	for _, o := range orders {
		desc, ok := cache[o.SKU]
		if !ok {
			desc = ps.describeOrder(o)
			cache[o.SKU] = desc
		}
		rows = append(rows, adminOrderRow{Order: o, Desc: desc})
	}
	return rows
}

// describeOrder 订单描述（快照优先；回退 Domain.DescribeSnapshot 实时解析）。
func (ps *PanelServer) describeOrder(o osv.Order) string {
	if o.DescSnapshot != "" {
		return o.DescSnapshot
	}
	return ps.St.DescribeSnapshot(o.SKU)
}

// orderPanelRows 订单行（8 列：单号/内容/渠道/状态/金额/联系/激活码/时间；
// 渠道文案单源 ordercore ChannelLabel——拾音值域 manual/native/App/试用）。
func orderPanelRows(rows []adminOrderRow) [][]string {
	out := make([][]string, 0, len(rows))
	for _, r := range rows {
		ch := store.ChannelLabel(r.Channel, r.Tag)
		out = append(out, []string{r.OrderNo, r.Desc, ch, r.Status,
			fmt.Sprintf("%.2f", float64(r.Amount)/100), r.Contact,
			strings.Join(r.PoolIDs, " "), osv.FmtTimeCST(r.CreatedAt)})
	}
	return out
}

// orderExtra 订单行机器可读附加（epoch 时间+码激活聚合+标签徽章；与 rows 下标对齐）。
// 2026-11-03 码生命周期六桶扩展（面板徽章「激活 a/N · 并入 m · 他机 o · 过期 e」
// 数据源；omitempty=旧平台窗口期字段缺省，bp.js ?? 防御降级单段）。
type orderExtra struct {
	CreatedAt   int64  `json:"created_at"`
	PaidAt      int64  `json:"paid_at"`
	DeliveredAt int64  `json:"delivered_at"`
	AssignedN   int    `json:"assigned_n"`
	ActivatedN  int    `json:"activated_n"`
	RebindN     int    `json:"rebind_n,omitempty"`
	MergedSelfN int    `json:"merged_self_n,omitempty"`
	BoundOtherN int    `json:"bound_other_n,omitempty"`
	ExpiredN    int    `json:"expired_n,omitempty"`
	Tag         string `json:"tag,omitempty"`
}

// orderExtras 批量组装行附加（srv/keys-agg 单次往返，uid 空=面板模式；失败
// 静默省略聚合数——橙点与新徽章同步降级，管理台可用性不受平台可用性拖累）。
func (ps *PanelServer) orderExtras(orders []osv.Order) []orderExtra {
	nos := make([]string, 0, len(orders))
	for _, o := range orders {
		nos = append(nos, o.OrderNo)
	}
	aggs := map[string]srv.KeyAgg{}
	if sc := ps.St.SRV(); sc != nil {
		if m, _, err := sc.KeysAggUID(nos, ""); err == nil {
			aggs = m
		}
	}
	out := make([]orderExtra, len(orders))
	for i, o := range orders {
		e := orderExtra{CreatedAt: o.CreatedAt, PaidAt: o.PaidAt, DeliveredAt: o.DeliveredAt, Tag: o.Tag}
		if a, ok := aggs[o.OrderNo]; ok {
			e.AssignedN, e.ActivatedN = a.AssignedN, a.ActivatedN
			e.RebindN, e.MergedSelfN, e.BoundOtherN, e.ExpiredN = a.RebindN, a.MergedSelfN, a.BoundOtherN, a.ExpiredN
		}
		out[i] = e
	}
	return out
}

// orderModalActions 订单详情弹层操作声明（订单级显隐 field=原始值；净屏同构）。
func orderModalActions(presetTags []string) []map[string]any {
	return []map[string]any{
		{"id": "confirm_paid", "label": "确认收款", "primary": true,
			"fields": []map[string]any{
				{"name": "actual_cents", "label": "实收金额（元，默认=应收）", "type": "text",
					"unit": "yuan_to_cents", "default_from": "amount"}},
			"hide_when": []map[string]any{
				{"field": "channel", "values": []string{"manual"}},
				{"field": "status", "values": []string{"paid", "delivered", "closed"}}}},
		{"id": "order_test_toggle", "label": "标测试/取消",
			"confirm": "切换该单的测试标记？标记后默认列表不再显示；测试单不计销售额与订单数。"},
		{"id": "order_settag", "label": "改标签",
			"fields": []map[string]any{
				{"name": "tag", "label": "用途标签（留空=未分类）", "type": "tags",
					"options": presetTags, "default_from": "tag"}}},
		{"id": "order_edit_amount", "label": "改金额",
			"fields": []map[string]any{
				{"name": "amount", "label": "新金额（元）", "type": "text", "default_from": "amount"}},
			"hide_when": []map[string]any{
				{"field": "status", "values": []string{"closed"}}}},
		{"id": "order_cancel", "label": "关闭订单", "danger": true,
			"confirm": "确认关闭订单？关闭后买家无法再付款（仅待支付单可关）。",
			"hide_when": []map[string]any{
				{"field": "status", "values": []string{"paid", "delivered", "closed"}}}},
	}
}

// ---------- query ----------

func (ps *PanelServer) handleQuery(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	switch q.Get("kind") {
	case "orders":
		// q 空恒走窗口查询（首屏同口径）；q 非空走搜索路径（单号/链接/联系方式）
		if strings.TrimSpace(q.Get("q")) == "" {
			var curTime int64
			var curNo string
			if c := q.Get("cursor"); c != "" {
				parts := strings.SplitN(c, "|", 2)
				if len(parts) == 2 {
					curTime, _ = strconv.ParseInt(parts[0], 10, 64)
					curNo = parts[1]
				}
			}
			orders, next, err := ps.St.ListOrdersWindow(q.Get("kind_filter"), q.Get("otag"),
				q.Get("status"), q.Get("window"), q.Get("q"), curTime, curNo, 200)
			if err != nil {
				errJSON(w, http.StatusBadRequest, err.Error())
				return
			}
			out := map[string]any{
				"cols":       orderPanelCols(),
				"rows":       orderPanelRows(ps.adminOrderRows(orders)),
				"rows_extra": ps.orderExtras(orders)}
			if next != "" {
				out["next_cursor"] = next
			}
			writeJSON(w, http.StatusOK, out)
			return
		}
		orders, err := ps.searchOrders(q.Get("q"), q.Get("status"))
		if err != nil {
			log.Printf("[PANEL] query orders: %v", err)
			errJSON(w, http.StatusInternalServerError, "查询失败（详见服务端日志）")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"cols":       orderPanelCols(),
			"rows":       orderPanelRows(ps.adminOrderRows(orders)),
			"rows_extra": ps.orderExtras(orders)})
	case "global_search":
		// 客服查单聚合：q=订单号精确（含 order_no= 链接提取）/手机号邮箱模糊+
		// 码前缀（平台 /srv/keys prefix 透传，失败静默空）。≥2 字符由前端保证。
		qs := strings.TrimSpace(q.Get("q"))
		out := map[string]any{"orders": []map[string]any{}, "keys": []map[string]any{}}
		if len([]rune(qs)) >= 2 {
			orders := []osv.Order{}
			if strings.HasPrefix(qs, store.OrderNoPrefix()) {
				if o, err := ps.St.GetOrder(qs); err == nil {
					orders = []osv.Order{o}
				}
			}
			if len(orders) == 0 {
				if os, err := ps.searchOrders(qs, ""); err == nil {
					if len(os) > 10 {
						os = os[:10]
					}
					orders = os
				}
			}
			var keys []srv.Key
			if sc := ps.St.SRV(); sc != nil {
				if ks, err := sc.KeysByPrefix(qs, 10); err == nil {
					keys = ks
				}
			}
			writeJSON(w, http.StatusOK, orderSearchOut(orders, keys))
			return
		}
		writeJSON(w, http.StatusOK, out)
	case "order_codes":
		ps.handleOrderCodes(w, q)
	case "dash_metric":
		metric, win := q.Get("metric"), q.Get("w")
		// dashMetricDetail 明细统一错误收口（看板补齐批代码审架 I-1 对齐净屏
		// S-16 拍板）：内部错误文本可含 SQL 细节不直传响应体——细节进服务端日志，
		// 响应恒 500 固定文案（明细弹窗低频如实降级，与卡面静默策略配合）；
		// 既有 sales/trial case 同病连带收口，消除 400/502/500 三态分裂
		dashMetricDetail := func(d *osv.DashDetail, err error) {
			if err != nil {
				log.Printf("[PANEL] dash_metric %s: %v", metric, err)
				errJSON(w, http.StatusInternalServerError, "查询失败（详见服务端日志）")
				return
			}
			writeJSON(w, http.StatusOK, d)
		}
		switch metric {
		case "sales_today", "sales_total":
			d, err := ps.St.SalesDetail(metric, win, q.Get("ch"))
			dashMetricDetail(d, err)
		case "trial":
			d, err := ps.St.TrialDetail(win)
			dashMetricDetail(d, err)
		case "visit_today", "visit_total":
			// 浏览明细（看板补齐批 2026-11-03，净屏同名 metric 同构；主表页面
			// 聚合+Extra 环境/渠道+More 访客轨迹三区块，store.VisitDetail）
			d, err := ps.St.VisitDetail(metric, win)
			dashMetricDetail(d, err)
		case "download":
			d, err := ps.St.DownloadDetail()
			dashMetricDetail(d, err)
		case "buy":
			// 购买点击明细（w 时间窗+source 来源筛选，净屏同名 metric 同构）
			d, err := ps.St.BuyClickDetail(win, q.Get("source"))
			dashMetricDetail(d, err)
		default:
			errJSON(w, http.StatusBadRequest, "未知 metric（拾音开放：sales_today/sales_total/trial/visit_today/visit_total/download/buy）")
		}
	case "order_stats_by_uid":
		// 设备 360 徽章数据源（平台管理台设备页跨产品代理调用——批2 代码审 I-1
		// 补装）：uids 批量聚合 / pending=1 全集两模式互斥（同给 400）
		pendingMode := q.Get("pending") == "1"
		rawUIDs := strings.TrimSpace(q.Get("uids"))
		if pendingMode == (rawUIDs != "") {
			errJSON(w, http.StatusBadRequest, "uids 与 pending=1 必须二选一")
			return
		}
		if pendingMode {
			m, truncated, err := ps.St.PendingUIDStats()
			if err != nil {
				log.Printf("[PANEL] pending_uid_stats: %v", err)
				errJSON(w, http.StatusInternalServerError, "查询失败（详见服务端日志）")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"stats": map[string]any{}, "pending_uids": m, "truncated": truncated})
			return
		}
		uids := strings.Split(rawUIDs, ",")
		if len(uids) > panelUIDsLimit {
			errJSON(w, http.StatusBadRequest, "uids 超上限（≤200，与设备页单页对齐）")
			return
		}
		for _, u := range uids {
			if len(u) > panelUIDMaxLen {
				errJSON(w, http.StatusBadRequest, "uid 单项超长（≤128）")
				return
			}
		}
		stats, err := ps.St.OrderStatsByUIDs(uids)
		if err != nil {
			log.Printf("[PANEL] order_stats_by_uid: %v", err)
			errJSON(w, http.StatusInternalServerError, "查询失败（详见服务端日志）")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"stats": stats})
	case "orders_by_uid":
		// 设备 360 明细弹层订单列表（≤20 倒序，排纯测试口径单源 store 层）
		uid := strings.TrimSpace(q.Get("uid"))
		if uid == "" {
			errJSON(w, http.StatusBadRequest, "uid 必填")
			return
		}
		if len(uid) > panelUIDMaxLen {
			errJSON(w, http.StatusBadRequest, "uid 超长（≤128）")
			return
		}
		orders, err := ps.St.QueryOrdersByUIDAdmin(uid)
		if err != nil {
			log.Printf("[PANEL] orders_by_uid: %v", err)
			errJSON(w, http.StatusInternalServerError, "查询失败（详见服务端日志）")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"orders": ps.deviceOrderRows(orders)})
	case "orders_by_nos":
		// 设备 360 绑定派生订单列表（平台 Keys[] 全集 order_no 集合查单；
		// normalize-then-validate 与 store 层清洗对称）
		rawNos := strings.TrimSpace(q.Get("nos"))
		if rawNos == "" {
			errJSON(w, http.StatusBadRequest, "nos 必填")
			return
		}
		nos := make([]string, 0, 8)
		for _, n := range strings.Split(rawNos, ",") {
			if n = strings.TrimSpace(n); n != "" {
				nos = append(nos, n)
			}
		}
		if len(nos) == 0 {
			errJSON(w, http.StatusBadRequest, "nos 必填")
			return
		}
		if len(nos) > panelNosLimit {
			errJSON(w, http.StatusBadRequest, "nos 超上限（≤200）")
			return
		}
		for _, n := range nos {
			if len(n) > panelNoMaxLen {
				errJSON(w, http.StatusBadRequest, "单号超长（≤32）")
				return
			}
		}
		orders, err := ps.St.OrdersByNos(nos)
		if err != nil {
			log.Printf("[PANEL] orders_by_nos: %v", err)
			errJSON(w, http.StatusInternalServerError, "查询失败（详见服务端日志）")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"orders": ps.deviceOrderRows(orders)})
	default:
		// 白名单单源=ordercore/panel（跨仓契约）；错误文案只列拾音开放子集
		//（批2 代码审 S12：全量白名单含未开放项对运营误导）
		errJSON(w, http.StatusBadRequest, "未知 kind（拾音开放：orders/order_codes/global_search/dash_metric/order_stats_by_uid/orders_by_uid/orders_by_nos）")
	}
}

// handleOrderCodes 订单详情聚合弹层数据源（净屏同构：码行+绑定设备+事件流水+
// 冲减预估+orderModalActions+标签候选；srv 失败静默降级——订单操作不因平台抖动
// 不可用）。
func (ps *PanelServer) handleOrderCodes(w http.ResponseWriter, q map[string][]string) {
	get := func(k string) string {
		if vs := q[k]; len(vs) > 0 {
			return strings.TrimSpace(vs[0])
		}
		return ""
	}
	orderNo := get("order_no")
	o, err := ps.St.GetOrder(orderNo)
	if err != nil {
		errJSON(w, http.StatusNotFound, "订单不存在")
		return
	}
	type codeRow struct {
		ID          string         `json:"id"`
		Status      string         `json:"status"`
		Tier        string         `json:"tier,omitempty"`
		MergedInto  string         `json:"merged_into,omitempty"`
		MergedChain []srv.MergeHop `json:"merged_chain,omitempty"`
	}
	codes := []codeRow{}
	devices := map[string]any{}
	if sc := ps.St.SRV(); sc != nil {
		if keys, devs, kerr := sc.KeysWithDevices(orderNo); kerr == nil {
			for _, k := range keys {
				codes = append(codes, codeRow{ID: k.KeyID, Status: k.Status, Tier: k.Tier,
					MergedInto: k.MergedInto, MergedChain: k.MergedChain})
			}
			for kid, list := range devs {
				devices[kid] = list
			}
		}
	}
	evs := o.Events
	if evs == nil {
		evs = []osv.OrderEvent{}
	}
	// 冲减预估（回显）：剩余金额÷剩余未处理张数（与 reduceManualAmount 同式）
	done := 0
	for _, ev := range o.Events {
		if ev.Kind == "return" || ev.Kind == "void" {
			done++
		}
	}
	remain := o.Qty - done
	if remain <= 0 {
		remain = 1
	}
	estimate := o.Amount / remain
	if estimate < 0 {
		estimate = 0
	}
	presetTags := ps.St.PresetTags()
	// 顶层扁平契约，单源=净屏 order_codes 响应（tomato backend/admin/panel.go；
	// 平台 bp.js orderDetailHTML 读顶层字段）——批2 首版嵌套 order{} 形状致详情头
	// 全 undefined，2026-11-02 对齐；键集合回归锁见 api TestPanelFlow。
	writeJSON(w, http.StatusOK, map[string]any{
		"order_no": o.OrderNo, "status": o.Status, "channel": o.Channel,
		"tag": o.Tag, "amount": fmt.Sprintf("%.2f", float64(o.Amount)/100),
		"created_at": o.CreatedAt, "paid_at": o.PaidAt, "delivered_at": o.DeliveredAt,
		"reduce_estimate": fmt.Sprintf("%.2f", float64(estimate)/100),
		"codes":           codes, "devices": devices, "events": evs,
		"preset_tags": presetTags,
		"actions":     orderModalActions(presetTags)})
}

// searchOrders 订单搜索（q 空=按状态列表；q 形似订单号=精确；其余联系方式模糊）。
func (ps *PanelServer) searchOrders(q, status string) ([]osv.Order, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return ps.St.ListOrders(status)
	}
	if no := extractOrderNo(q); no != "" {
		o, err := ps.St.GetOrder(no)
		if err != nil {
			return []osv.Order{}, nil
		}
		return []osv.Order{o}, nil
	}
	return ps.St.QueryOrdersByContactFuzzy(q)
}

// extractOrderNo 订单号提取（order_no= 链接段或 SY 前缀裸单号；拾音前缀单源
// store.OrderNoPrefix）。
func extractOrderNo(q string) string {
	if i := strings.Index(q, "order_no="); i >= 0 {
		rest := q[i+len("order_no="):]
		if j := strings.IndexAny(rest, "& "); j >= 0 {
			rest = rest[:j]
		}
		return strings.TrimSpace(rest)
	}
	if strings.HasPrefix(q, store.OrderNoPrefix()) {
		return q
	}
	return ""
}

// orderSearchOut global_search 响应组装（orders≤10+keys≤10；srv 失败 keys 空）。
func orderSearchOut(orders []osv.Order, keys []srv.Key) map[string]any {
	if len(orders) > 10 {
		orders = orders[:10]
	}
	ol := []map[string]any{}
	for _, o := range orders {
		ol = append(ol, map[string]any{
			"order_no": o.OrderNo, "status": o.Status, "channel": o.Channel,
			"tag": o.Tag, "contact": o.Contact,
			"amount": fmt.Sprintf("%.2f", float64(o.Amount)/100),
			"time":   osv.FmtTimeCST(o.CreatedAt)})
	}
	kl := []map[string]any{}
	for _, k := range keys {
		kl = append(kl, map[string]any{
			"key_id": k.KeyID, "status": k.Status,
			"order_no": k.OrderNo, "sku": k.SKU})
	}
	return map[string]any{"orders": ol, "keys": kl}
}

// ---------- action ----------

func (ps *PanelServer) handleAction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ActionID string         `json:"action_id"`
		Values   map[string]any `json:"values"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<20)).Decode(&req); err != nil || req.ActionID == "" {
		errJSON(w, http.StatusBadRequest, "bad_request")
		return
	}
	val := func(k string) string {
		s, _ := req.Values[k].(string)
		return strings.TrimSpace(s)
	}
	respond := func(ok bool, message string, ids []string) {
		out := map[string]any{"ok": ok, "message": message}
		if ids != nil {
			out["ids"] = ids
		}
		writeJSON(w, http.StatusOK, out)
	}
	switch req.ActionID {
	case "confirm_paid":
		orderNo := val("order_no")
		// actual_cents 契约=分（前端 unit=yuan_to_cents 已换算，后端直收——
		// 净屏审查 C-2：二次换算致实收放大 100 倍教训）
		// 文案带收到值（2026-11-02 事故复盘：缺字段/数字类型 JSON 均落 Atoi 空串，
		// 只报「无效」无法区分三态，线上排查绕远）
		raw := val("actual_cents")
		cents, convErr := strconv.Atoi(raw)
		if convErr != nil || cents < 0 {
			if raw == "" {
				respond(false, "实收金额无效（未收到金额字段，请强刷管理台页面重试）", nil)
			} else {
				respond(false, "实收金额无效（收到："+raw+"）", nil)
			}
			return
		}
		ids, err := ps.St.AdminConfirmPaid(orderNo, cents)
		if err != nil {
			respond(false, "确认失败："+err.Error(), nil)
			return
		}
		respond(true, "已发码", ids)
	case "order_test_toggle":
		o, err := ps.St.GetOrder(val("order_no"))
		if err != nil {
			respond(false, err.Error(), nil)
			return
		}
		if err := ps.St.SetOrderTest(val("order_no"), !o.IsTest); err != nil {
			respond(false, err.Error(), nil)
			return
		}
		if !o.IsTest {
			respond(true, "已标记测试单（默认列表已隐藏；类型筛选选「测试」可查看与取消）", nil)
		} else {
			respond(true, "已取消测试标记（回到默认列表）", nil)
		}
	case "order_cancel":
		if err := ps.St.CancelPendingOrder(val("order_no")); err != nil {
			respond(false, err.Error(), nil)
			return
		}
		respond(true, "订单已关闭", nil)
	case "order_detail":
		respond(false, "详情弹层需新版管理台：请强刷页面（Ctrl+Shift+R）或稍后重试", nil)
	case "manual_order_create":
		in := osv.ManualOrderInput{
			SKU:         val("sku"),
			Tag:         val("tag"),
			Contact:     val("contact"),
			ClientToken: val("form_token"),
		}
		if in.SKU == "" {
			respond(false, "未选择 SKU", nil)
			return
		}
		if v := val("qty"); v != "" {
			n, e := strconv.Atoi(v)
			if e != nil || n <= 0 {
				respond(false, "数量无效", nil)
				return
			}
			in.Qty = n
		} else {
			in.Qty = 1
		}
		if v := val("amount"); v != "" {
			f, e := strconv.ParseFloat(v, 64)
			if e != nil || f < 0 {
				respond(false, "金额无效（元）", nil)
				return
			}
			in.AmountCents = int(math.Round(f * 100))
		} else {
			// 留空=SKU 目录价×数量（缓存快照价；组合串走 ComboTotalCents）
			if osv.IsCombo(in.SKU) {
				items, e := ps.St.ResolveCombo(in.SKU)
				if e != nil {
					respond(false, "组合无效："+e.Error(), nil)
					return
				}
				in.AmountCents = osv.ComboTotalCents(items)
			} else if sk, err := ps.St.GetSKU(in.SKU); err == nil {
				in.AmountCents = sk.PriceCents * in.Qty
			} else {
				respond(false, "SKU 不存在或缓存未就绪", nil)
				return
			}
		}
		o, ids, err := ps.St.CreateManualChannelOrder(in)
		if err != nil {
			respond(false, "建单失败："+err.Error(), nil)
			return
		}
		respond(true, fmt.Sprintf("已建单 %s（%s · %s · ¥%.2f）", o.OrderNo, o.SKU, o.Tag, float64(o.Amount)/100), ids)
	case "code_return":
		newID, err := ps.St.ManualCodeReturn(val("order_no"), val("code_id"),
			boolVal(req.Values["reduce"]) || req.Values["reduce"] == nil, val("note"))
		if err != nil {
			respond(false, err.Error(), nil)
			return
		}
		respond(true, "已回池，新码号 "+newID+" 回库存", nil)
	case "code_void":
		if err := ps.St.ManualCodeVoid(val("order_no"), val("code_id"),
			boolVal(req.Values["reduce"]) || req.Values["reduce"] == nil, val("note")); err != nil {
			respond(false, err.Error(), nil)
			return
		}
		respond(true, "码已作废（不可激活，销售额同步修正）", nil)
	case "order_settag":
		if err := ps.St.SetOrderTag(val("order_no"), val("tag")); err != nil {
			respond(false, err.Error(), nil)
			return
		}
		respond(true, "标签已更新（不影响统计）", nil)
	case "order_edit_amount":
		f, e := strconv.ParseFloat(val("amount"), 64)
		if e != nil || f < 0 {
			respond(false, "金额无效（元）", nil)
			return
		}
		if err := ps.St.EditOrderAmount(val("order_no"), int(math.Round(f*100)), val("note")); err != nil {
			respond(false, err.Error(), nil)
			return
		}
		respond(true, "金额已更新", nil)
	case "trial_order_create":
		// 平台 claim 即时建单回调（净屏「claim 即建+cron 兜底」双路之即时路）。
		// 载荷契约=平台 trial.go notifyTrialOrder 实发形态：{"grant_id":<int64
		// json number>,"device_id","key_id"}（无 granted_at——at<=0 兜底 now，
		// 净屏 :926-931 同款）。批2 代码审 C1 修正：键名/类型双形态度错——
		// 原读 "id"+.(string) 对平台载荷恒失败（即时路静默退化为纯 cron）。
		grantID := anyID(req.Values["grant_id"])
		if grantID <= 0 {
			respond(false, "grant id 无效", nil)
			return
		}
		at := anyID(req.Values["granted_at"])
		created, err := ps.St.TrialOrderCreate(grantID, val("device_id"), val("key_id"), at)
		if err != nil {
			respond(false, "试用补单失败："+err.Error(), nil)
			return
		}
		if created {
			respond(true, "试用单已建", nil)
		} else {
			respond(true, "试用单已存在（幂等跳过）", nil)
		}
	case "config_set":
		// 运营配置保存（meta 表 KV；native_checkout checkbox=「1」/「0」显式落值）。
		// 逐键 upsert 非原子（批2 代码审 S7，单人运营低频接受）——失败显式回报
		// 已保存进度，不留「看起来全存了」的静默半保存
		keys := []string{"xianyu_item_url", "contact_url", "service_hours", "combo_rates"}
		for i, k := range keys {
			if err := ps.St.SettingSet(k, val(k)); err != nil {
				respond(false, fmt.Sprintf("保存失败于 %s（前 %d 项已保存）：%v", k, i, err), nil)
				return
			}
		}
		nc := "0"
		if boolVal(req.Values["native_checkout"]) {
			nc = "1"
		}
		if err := ps.St.SettingSet("native_checkout", nc); err != nil {
			respond(false, "保存失败于 native_checkout（此前各项已保存）："+err.Error(), nil)
			return
		}
		respond(true, "配置已保存", nil)
	default:
		respond(false, "未知操作: "+req.ActionID, nil)
	}
}

func boolVal(v any) bool {
	b, _ := v.(bool)
	return b
}

// anyID 跨仓回调载荷 id 双形态容错（JSON number→float64 / 字符串；批2 代码审
// C1：平台 notifyTrialOrder 发 int64 number，纯 string 断言恒失败）。
func anyID(v any) int64 {
	switch x := v.(type) {
	case float64:
		return int64(x)
	case string:
		n, _ := strconv.ParseInt(strings.TrimSpace(x), 10, 64)
		return n
	case int64:
		return x
	}
	return 0
}

// panel 防御性上限（净屏同款语义；批2 I-1 三 kind 补装随迁）。
const (
	panelUIDMaxLen = 128
	panelUIDsLimit = 200
	panelNosLimit  = 200
	panelNoMaxLen  = 32
)

// deviceOrderRows 设备 360 订单行组装单源（orders_by_uid/orders_by_nos 共用；
// 净屏同构：uid/channel/tag/created_at 为来源列原始键，desc 快照优先、实时回退）。
func (ps *PanelServer) deviceOrderRows(orders []osv.Order) []map[string]any {
	rows := make([]map[string]any, 0, len(orders))
	for _, o := range orders {
		desc := o.DescSnapshot
		if desc == "" {
			desc = ps.St.DescribeSnapshot(o.SKU)
		}
		rows = append(rows, map[string]any{
			"order_no": o.OrderNo, "status": o.Status,
			"amount": fmt.Sprintf("%.2f", float64(o.Amount)/100),
			"desc":   desc, "time": osv.FmtTimeCST(o.CreatedAt),
			"uid": o.UID, "channel": o.Channel, "tag": o.Tag,
			"created_at": o.CreatedAt})
	}
	return rows
}

// orders.go 拾音订单/商品 HTTP 面（批2，方案 doc/plans/shiyin-order-domain.md
// §四批2；净屏 backend/api/api.go 订单段对照搬运+拾音裁剪）：
//   - GET  /api/skus        套餐目录+运营扩展字段单接口（恒 manual 支付形态）
//   - POST /api/order/create 原生下单（幂等 client_token；恒 manual 闲鱼引导）
//   - GET  /api/orders      订单中心批量查询（凭证分级：nos 强凭证=full 带码 /
//     uid 弱凭证=脱敏无码）
//   - POST /api/order/cancel 用户取消待支付单（仅 pending 可关）
//
// 裁剪项：无支付通道分流（净屏 online 分支——拾音拍板人工闲鱼链路）；
// /order/query H5 查询页不做（购买面在 App 内，客服对单走管理台）。
package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"

	osv "ordercore/orderstore"

	"shiyin/backend/store"
)

// ProductID 拾音产品键（X-Product 头值；App 侧 ActivationSdk.productId 同值）。
const ProductID = "shiyin"

// skuDTO 目录条目（PlanSkus.kt 解析字段同构；与净屏 api.go skuDTO 同构）。
type skuDTO struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Apps        []string `json:"apps"`
	Tier        string   `json:"tier"`
	Days        int      `json:"days"`
	DeviceLimit int      `json:"device_limit"`
	PriceCents  int      `json:"price_cents"`
}

// buildSkusPayload 套餐目录单接口响应体（净屏同构纯函数）：目录（/srv/skus
// 缓存，下单兜底实时拉）+运营扩展字段合成一个响应。payable 对齐平台口径恒 true
// （入口开合由 native_checkout 驱动）。ext 同名 key 不得覆盖目录字段（后写）。
func buildSkusPayload(skus []store.SKU, ext map[string]any) map[string]any {
	out := make([]skuDTO, 0, len(skus))
	for _, sk := range skus {
		apps := sk.Apps
		if apps == nil {
			apps = []string{}
		}
		out = append(out, skuDTO{
			ID: sk.ID, Name: sk.Name, Apps: apps, Tier: sk.Tier,
			Days: sk.Days, DeviceLimit: sk.DeviceLimit, PriceCents: sk.PriceCents,
		})
	}
	resp := map[string]any{}
	for k, v := range ext {
		resp[k] = v
	}
	resp["payable"] = true
	resp["skus"] = out
	return resp
}

// purchasableSKUs 选购页下发口径（批2 方案 S11）：enabled=1 且排除试用档
// （auto3=首启免费试用通道 SKU，不零售——净屏 trial7/trial3 同款排除语义）。
func purchasableSKUs(all []store.SKU) []store.SKU {
	out := make([]store.SKU, 0, len(all))
	for _, sk := range all {
		if sk.Tier == "auto3" || sk.Tier == "trial7" || sk.Tier == "trial3" {
			continue
		}
		out = append(out, sk)
	}
	return out
}

// handleApiSkus GET /api/skus。失败语义（净屏 4.7.2 审查 I-8 同款）：目录缓存为
// 空（srv 断连且从未拉到）=503——App 端对非 2xx 走失败路径保留旧缓存渲染；恒
// 200 空数组会被 App 当成功把旧缓存覆盖为空（套餐页空白）。
func (s *Server) handleApiSkus(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	// no-store 第二保险（批2 代码审 S9）：skuExt 含 native_checkout/xianyu_url
	// 运营可变字段，「关 flag 即暂停入口」显隐面不依赖 EdgeOne 控制台单点
	w.Header().Set("Cache-Control", "no-store")
	all, err := s.St.ListSKUs(true)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	skus := purchasableSKUs(all)
	if len(skus) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "sku_cache_empty"})
		return
	}
	writeJSON(w, http.StatusOK, buildSkusPayload(skus, s.skuExt()))
}

// skuExt 运营扩展字段集（/api/skus 单接口内嵌；字段集=PlanSkus.kt 解析全集，
// 净屏 SKUExt 同构。拾音恒 pay_mode=manual——人工闲鱼链路拍板，无支付通道）。
func (s *Server) skuExt() map[string]any {
	var itemID string
	if s.XY != nil {
		itemID = s.XY.ItemID()
	}
	return map[string]any{
		"pay_mode": "manual",
		// 组合折扣表服务端单一事实源下发（App 本地实时算价）；native_checkout
		// 灰度 flag（meta 可配，关=/api/order/create 409——暂停 App 下单通道）；
		// 闲鱼商品链接+itemId（fleamarket:// 唤端，空=退链接现状）；客服时段/链接。
		"combo_rates":     comboRates(),
		"native_checkout": s.St.Setting("native_checkout") == "1",
		"xianyu_url":      s.St.Setting("xianyu_item_url"),
		"xianyu_item_id":  itemID,
		"contact_url":     s.St.Setting("contact_url"),
		"service_hours":   s.serviceHours(),
	}
}

// comboRate 组合折扣行（n=件数，r=千分比折扣）。
type comboRate struct {
	N int `json:"n"`
	R int `json:"r"`
}

// comboRates 折扣表下发（单源 ordercore DiscountPerMille——净屏 2026-10-14
// 拍板表值随包共享：800/750/…/500）。
func comboRates() []comboRate {
	out := make([]comboRate, 0, 7)
	for n := 2; n <= 8; n++ {
		out = append(out, comboRate{N: n, R: osv.DiscountPerMille(n)})
	}
	return out
}

// serviceHours 客服时段文案（meta 可配；缺省=净屏同款缺省值）。
func (s *Server) serviceHours() string {
	if v := s.St.Setting("service_hours"); v != "" {
		return v
	}
	return "每日 12:00-23:00"
}

// handleNativeOrderCreate 原生下单（净屏同构；拾音恒 manual——无支付通道分流，
// native_checkout 灰度 flag 保留=暂停售卖应急开关）：JSON {sku, uid,
// client_token} → 幂等建单 → 返回订单号+金额快照+闲鱼链接+客服时段（支付引导
// 页数据齐发，免二次拉取）。
func (s *Server) handleNativeOrderCreate(w http.ResponseWriter, r *http.Request) {
	// 灰度 flag 服务端强制校验（净屏收尾审查 I1 同款）：入口判定依赖 App 端 SKU
	// 缓存（无失效期），关 flag 后持旧缓存设备仍会进下单——此处拦截使
	// 「关闭即回滚售卖入口」真正闭环
	if s.St.Setting("native_checkout") != "1" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "native_checkout_disabled"})
		return
	}
	if rl, err := s.St.OrderRateLimited(clientIP(r)); err == nil && rl {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate_limited"})
		return
	}
	var req struct {
		SKU         string `json:"sku"`
		UID         string `json:"uid"`
		ClientToken string `json:"client_token"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	req.SKU = strings.TrimSpace(req.SKU)
	if req.SKU == "" || len(req.SKU) > 512 || strings.Count(req.SKU, "+")+1 > 8 ||
		len(req.UID) > 128 || len(req.ClientToken) > 128 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	// 试用档不零售（批2 代码审 S8）：下单口径与选购页一致（auto3=首启免费试用
	// 通道专用，绕道下单=绕过「首启」限制多领试用码；组合段经 resolveCombo
	// ComboRestrictedTiers 拒绝，此处拦单段直购）
	if !osv.IsCombo(req.SKU) {
		if sk, err := s.St.GetSKU(req.SKU); err == nil &&
			(sk.Tier == "auto3" || sk.Tier == "trial7" || sk.Tier == "trial3") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "sku_not_found"})
			return
		}
	}
	o, err := s.St.CreateManualOrder(req.SKU, "", clientIP(r), req.UID, req.ClientToken)
	if err != nil {
		switch {
		case errors.Is(err, osv.ErrOrderRateLimited):
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate_limited"})
		case errors.Is(err, osv.ErrOrderTokenReplay):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "token_conflict"})
		case errors.Is(err, osv.ErrSkuNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "sku_not_found"})
		case errors.Is(err, osv.ErrComboRestricted):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "combo_restricted"})
		case errors.Is(err, osv.ErrComboDupApp):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "combo_dup_app"})
		default:
			log.Printf("[ORDER] create: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		}
		return
	}
	writeJSON(w, http.StatusOK, s.orderCreateResponse(o))
}

// orderCreateResponse 下单返回体（App 支付引导页数据齐发；字段集契约同净屏
// orderCreateResponse——拾音恒 pay_mode=manual）。
func (s *Server) orderCreateResponse(o osv.Order) map[string]any {
	var itemID string
	if s.XY != nil {
		itemID = s.XY.ItemID()
	}
	return map[string]any{
		"order_no":       o.OrderNo,
		"amount_cents":   o.Amount,
		"desc":           s.DescribeOrder(o),
		"is_combo":       osv.IsCombo(o.SKU),
		"status":         o.Status,
		"pay_mode":       "manual",
		"xianyu_url":     s.St.Setting("xianyu_item_url"),
		"xianyu_item_id": itemID,
		"service_hours":  s.serviceHours(),
	}
}

// nativeOrderDTO 订单中心条目（净屏同构）：full=true（订单号强凭证）→ 完整
// 订单号+激活码；full=false（uid 弱凭证）→ 脱敏单号+无码。CloseReason 仅 closed
// 单下发（user_cancel/timeout_close；存量旧单无事件为空串）。
type nativeOrderDTO struct {
	OrderNo     string   `json:"order_no,omitempty"`
	MaskedNo    string   `json:"masked_no"`
	Status      string   `json:"status"`
	CloseReason string   `json:"close_reason,omitempty"`
	AmountCents int      `json:"amount_cents"`
	Desc        string   `json:"desc"`
	IsCombo     bool     `json:"is_combo"`
	CreatedAt   int64    `json:"created_at"`
	Codes       []string `json:"codes,omitempty"`
	Full        bool     `json:"full"`
}

// orderCloseReason 从事件流水取关单类别（后写优先；非 closed 一律空串——
// closed→paid 复活单以 paid 状态携带陈旧关单原因属契约漂移，净屏审查 S5 同款）。
func orderCloseReason(o osv.Order) string {
	if o.Status != osv.OrderStatusClosed {
		return ""
	}
	reason := ""
	for _, ev := range o.Events {
		if ev.Kind == osv.OrderCloseReasonUserCancel || ev.Kind == osv.OrderCloseReasonTimeout {
			reason = ev.Kind
		}
	}
	return reason
}

// handleNativeOrders 订单中心批量查询（净屏同构，凭证分级披露）：nos=完整订单
// 号列表（强凭证，逗号分隔上限 20，逐单存在即 full 视图）；uid=设备标识（弱
// 凭证，脱敏视图，重装找回：看到有哪几单，凭闲鱼聊天里的订单号再查 full）。
func (s *Server) handleNativeOrders(w http.ResponseWriter, r *http.Request) {
	uid := strings.TrimSpace(r.URL.Query().Get("uid"))
	nosRaw := strings.TrimSpace(r.URL.Query().Get("nos"))
	if uid == "" && nosRaw == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	if len(uid) > 128 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	var nos []string
	if nosRaw != "" {
		for _, no := range strings.Split(nosRaw, ",") {
			no = strings.TrimSpace(no)
			if no != "" {
				nos = append(nos, no)
			}
		}
		if len(nos) > 20 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
			return
		}
	}
	out := []nativeOrderDTO{}
	seen := map[string]bool{}
	// nos 批量一次 IN 查询（批2 代码审 S4：单连接串行化下 20 次逐单往返放大队头
	// 延迟——复用 ordercore OrdersByNos；不存在单不出现=不泄露存在性语义不变）
	if len(nos) > 0 {
		found, err := s.St.OrdersByNos(nos)
		if err != nil {
			log.Printf("[ORDERS] by nos: %v", err)
		}
		for _, o := range found {
			if seen[o.OrderNo] {
				continue
			}
			seen[o.OrderNo] = true
			dto := nativeOrderDTO{OrderNo: o.OrderNo, MaskedNo: maskOrderNo(o.OrderNo),
				Status: o.Status, CloseReason: orderCloseReason(o), AmountCents: o.Amount,
				Desc: s.DescribeOrder(o), IsCombo: osv.IsCombo(o.SKU), CreatedAt: o.CreatedAt, Full: true}
			if o.Status == osv.OrderStatusDelivered && len(o.PoolIDs) > 0 {
				dto.Codes = o.PoolIDs
			}
			out = append(out, dto)
		}
	}
	if uid != "" {
		list, err := s.St.QueryOrdersByUID(uid)
		if err != nil {
			log.Printf("[ORDERS] by uid: %v", err)
		} else {
			for _, o := range list {
				if seen[o.OrderNo] {
					continue
				}
				seen[o.OrderNo] = true
				out = append(out, nativeOrderDTO{MaskedNo: maskOrderNo(o.OrderNo),
					Status: o.Status, CloseReason: orderCloseReason(o), AmountCents: o.Amount,
					Desc: s.DescribeOrder(o), IsCombo: osv.IsCombo(o.SKU), CreatedAt: o.CreatedAt, Full: false})
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": out})
}

// handleNativeOrderCancel 用户取消待支付订单（净屏同构）：订单号强凭证；仅
// pending 可取消（closed 幂等放行），paid/delivered 409 走客服。
func (s *Server) handleNativeOrderCancel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrderNo string `json:"order_no"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	no := strings.TrimSpace(req.OrderNo)
	if no == "" || len(no) > 64 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad_request"})
		return
	}
	if err := s.St.CancelPendingOrder(no); err != nil {
		if errors.Is(err, osv.ErrOrderNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "order_not_found"})
		} else {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "not_cancellable"})
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// DescribeOrder 订单描述（快照优先——数据自足不依赖运行时平台可用性；回退=
// Domain.DescribeSnapshot 实时解析；再失败兜底原始 sku id）。
func (s *Server) DescribeOrder(o osv.Order) string {
	if o.DescSnapshot != "" {
		return o.DescSnapshot
	}
	return s.St.DescribeSnapshot(o.SKU)
}

// maskOrderNo 订单号脱敏（弱凭证视图，净屏审查 C1 同款）：前 2+****+尾 4。
func maskOrderNo(no string) string {
	if len(no) <= 8 {
		return strings.Repeat("*", len(no))
	}
	return no[:2] + "****" + no[len(no)-4:]
}

// clientIP 下单限频取 IP（净屏 httputil.ClientIP 同语义：**X-Real-IP 优先**——
// 网关 proxy_set_header 下发的不可伪造还原 IP；XFF 首段兜底——客户端可伪造仅
// 降级防线；批2 代码审 I-2 修正：精简版曾漏 X-Real-IP 层致限频键可伪造）。
func clientIP(r *http.Request) string {
	if rip := strings.TrimSpace(r.Header.Get("X-Real-IP")); rip != "" {
		return rip
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			xff = xff[:i]
		}
		return strings.TrimSpace(xff)
	}
	// RemoteAddr 带 host:port——拾音只绑内网+网关反代，直连仅限本机诊断
	if i := strings.LastIndexByte(r.RemoteAddr, ':'); i > 0 {
		return r.RemoteAddr[:i]
	}
	return r.RemoteAddr
}

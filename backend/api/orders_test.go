// orders_test.go 订单/商品 API+业务面板集成测试（批2；假平台 httptest 模式——
// 净屏 mock_platform_test 同款思路精简版）：契约锁 /api/skus 字段全集（PlanSkus
// 解析口径，批2 方案 I-A：以净屏 sku_contract_test 为基线）、下单幂等/凭证分级、
// panel 三端点动线（summary/action/query+鉴权）、试用补单。
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	osrv "ordercore/srv"

	"shiyin/backend/cron"
	"shiyin/backend/store"
)

// fakePlatform 假平台 /srv 面（划码/查询族最小实现）。
func fakePlatform(issued map[string][]string) *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /srv/skus", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"skus": []map[string]any{
			{"id": "shiyin-d7", "name": "拾音·7天", "apps": []string{"shiyin"}, "tier": "d7", "days": 7, "device_limit": 1, "price_cents": 199, "enabled": true},
			{"id": "shiyin-m1", "name": "拾音·月卡", "apps": []string{"shiyin"}, "tier": "m1", "days": 30, "device_limit": 1, "price_cents": 499, "enabled": true},
			{"id": "shiyin-y1", "name": "拾音·年卡", "apps": []string{"shiyin"}, "tier": "y1", "days": 365, "device_limit": 1, "price_cents": 3590, "enabled": false},
			{"id": "shiyin-auto3", "name": "拾音·3天试用", "apps": []string{"shiyin"}, "tier": "auto3", "days": 3, "device_limit": 2, "price_cents": 0, "enabled": true},
		}})
	})
	mux.HandleFunc("POST /srv/deliver", func(w http.ResponseWriter, r *http.Request) {
		var req osrv.DeliverRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		ids := issued[req.OrderNo]
		if ids == nil {
			ids = []string{"SY-CODE-" + req.OrderNo}
			issued[req.OrderNo] = ids
		}
		_ = json.NewEncoder(w).Encode(osrv.DeliverResponse{IDs: ids, Codes: ids})
	})
	mux.HandleFunc("GET /srv/keys", func(w http.ResponseWriter, r *http.Request) {
		no := r.URL.Query().Get("order_no")
		prefix := r.URL.Query().Get("prefix")
		keys := []osrv.Key{}
		for o, ids := range issued {
			for _, id := range ids {
				if (no != "" && o == no) || (prefix != "" && strings.HasPrefix(id, prefix)) {
					keys = append(keys, osrv.Key{KeyID: id, SKU: "shiyin-m1", Status: "assigned", OrderNo: o})
				}
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": keys})
	})
	mux.HandleFunc("GET /srv/keys-agg", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"aggs": []osrv.KeyAgg{}})
	})
	mux.HandleFunc("GET /srv/config/sales", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(osrv.SalesConfig{PresetTags: []string{"闲鱼", "送人", "活动赠送"}})
	})
	mux.HandleFunc("GET /srv/trial-grants", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"grants": []map[string]any{
			{"id": 1, "device_id": "dev-t1", "key_id": "SY-TRIAL-1", "granted_at": 1700000000},
		}})
	})
	return httptest.NewServer(mux)
}

func newTestServer(t *testing.T) (apiURL, panelURL string, st *store.Store) {
	t.Helper()
	issued := map[string][]string{}
	fp := fakePlatform(issued)
	t.Cleanup(fp.Close)
	st, err := store.Open(filepath.Join(t.TempDir(), "shiyin-test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	st.SetSRV(osrv.New(fp.URL, "tok", ProductID))
	if err := st.RefreshSKUs(); err != nil { // 生产 main 启动 seed 同款
		t.Fatal(err)
	}
	if err := st.SettingSet("native_checkout", "1"); err != nil {
		t.Fatal(err)
	}
	if err := st.SettingSet("xianyu_item_url", "https://m.tb.cn/x"); err != nil {
		t.Fatal(err)
	}
	if err := st.SettingSet("contact_url", "https://faq.example"); err != nil {
		t.Fatal(err)
	}
	srv := &Server{St: st, PanelToken: "ptok"}
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts.URL, ts.URL, st
}

func get(t *testing.T, url, token string) (int, map[string]any) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	if token != "" {
		req.Header.Set("X-Panel-Token", token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func post(t *testing.T, url, token, body string) (int, map[string]any) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodPost, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("X-Panel-Token", token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

// TestSkusContract /api/skus 字段集契约锁（PlanSkus.kt 解析全集——批2 方案 I-A
// 基线=净屏 sku_contract_test 口径）+ 选购页过滤（enabled=1 且排 trial 档）。
func TestSkusContract(t *testing.T) {
	base, _, _ := newTestServer(t)
	code, body := get(t, base+"/api/skus", "")
	if code != 200 {
		t.Fatalf("status=%d body=%v", code, body)
	}
	for _, k := range []string{"payable", "skus", "pay_mode", "combo_rates",
		"native_checkout", "xianyu_url", "xianyu_item_id", "contact_url", "service_hours"} {
		if _, ok := body[k]; !ok {
			t.Fatalf("契约字段缺失: %s（全集=%v）", k, bodyKeys(body))
		}
	}
	if body["payable"] != true || body["pay_mode"] != "manual" || body["native_checkout"] != true {
		t.Fatalf("标量字段不符: %v", body)
	}
	skus := body["skus"].([]any)
	for _, s := range skus {
		id := s.(map[string]any)["id"].(string)
		if id == "shiyin-auto3" {
			t.Fatalf("试用档不得进选购页: %v", skus)
		}
	}
	if len(skus) != 2 { // d7+m1（y1 下架排除）
		t.Fatalf("选购页 SKU 数=%d want 2（y1 下架排除）", len(skus))
	}
}

func bodyKeys(m map[string]any) []string {
	ks := []string{}
	for k := range m {
		ks = append(ks, k)
	}
	return ks
}

// TestOrderCreateIdempotent 下单幂等：同 token 同参返回原单；换 uid 重放拒绝；
// 单号前缀=SY。
func TestOrderCreateIdempotent(t *testing.T) {
	base, _, _ := newTestServer(t)
	code, body := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev1","client_token":"tok1"}`)
	if code != 200 {
		t.Fatalf("create status=%d body=%v", code, body)
	}
	no := body["order_no"].(string)
	if !strings.HasPrefix(no, "SY") {
		t.Fatalf("单号前缀=%s want SY", no)
	}
	if body["pay_mode"] != "manual" || body["amount_cents"] != float64(499) {
		t.Fatalf("返回体不符: %v", body)
	}
	code, body2 := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev1","client_token":"tok1"}`)
	if code != 200 || body2["order_no"] != no {
		t.Fatalf("幂等重放不符: %d %v vs %s", code, body2["order_no"], no)
	}
	if code, _ := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev2","client_token":"tok1"}`); code != 409 {
		t.Fatalf("换 uid 重放应 409, got %d", code)
	}
}

// TestOrderCenterLevels 凭证分级+确认收款发码+取消：uid 视图脱敏无码；nos 视图
// full 带码；pending 可取消。
func TestOrderCenterLevels(t *testing.T) {
	base, _, _ := newTestServer(t)
	code, body := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev1","client_token":"tokc"}`)
	if code != 200 {
		t.Fatal(body)
	}
	no := body["order_no"].(string)
	// uid 弱凭证：脱敏无码
	code, body = get(t, base+"/api/orders?uid=dev1", "")
	orders := body["orders"].([]any)
	if len(orders) != 1 {
		t.Fatalf("uid 列单=%v", orders)
	}
	o := orders[0].(map[string]any)
	if o["full"] != false || o["order_no"] != nil || o["masked_no"] == "" {
		t.Fatalf("弱凭证视图不符: %v", o)
	}
	// pending 可取消（再建一张）
	_, b2 := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev1","client_token":"tokc2"}`)
	if code != 200 {
		t.Fatal(b2)
	}
	no2 := b2["order_no"].(string)
	if code, _ := post(t, base+"/api/order/cancel", "", `{"order_no":"`+no2+`"}`); code != 200 {
		t.Fatalf("取消失败 %d", code)
	}
	_ = no
	// 确认收款发码（panel action）→ nos 强凭证 full 带码
	code, resp := post(t, base+"/panel/action", "ptok", `{"action_id":"confirm_paid","values":{"order_no":"`+no+`","actual_cents":"499"}}`)
	if code != 200 || resp["ok"] != true {
		t.Fatalf("confirm_paid: %d %v", code, resp)
	}
	code, body = get(t, base+"/api/orders?nos="+no, "")
	orders = body["orders"].([]any)
	o = orders[0].(map[string]any)
	if o["full"] != true || o["order_no"] != no || o["codes"] == nil {
		t.Fatalf("full 视图不符: %v", o)
	}
}

// TestPanelFlow 面板三端点动线：summary 分区/订单搜索/order_codes 聚合/cfg 保存/
// 错 token 401。
func TestPanelFlow(t *testing.T) {
	base, _, st := newTestServer(t)
	// 错 token 401
	if code, _ := get(t, base+"/panel/summary", "wrong"); code != 401 {
		t.Fatalf("错 token 应 401, got %d", code)
	}
	code, body := get(t, base+"/panel/summary", "ptok")
	if code != 200 || body["registered"] != true {
		t.Fatalf("summary: %d %v", code, body)
	}
	ids := []string{}
	for _, s := range body["sections"].([]any) {
		ids = append(ids, s.(map[string]any)["id"].(string))
	}
	if strings.Join(ids, ",") != "dash,orders,cfg" {
		t.Fatalf("分区=%v want dash,orders,cfg（channelTbl/legacy_replay 裁剪后）", ids)
	}
	// 建单（panel 表单动线）→ 搜索 → order_codes
	code, resp := post(t, base+"/panel/action", "ptok", `{"action_id":"manual_order_create","values":{"sku":"shiyin-m1","qty":"1","amount":"45.00","tag":"闲鱼","contact":"闲鱼买家A","form_token":"mf-1"}}`)
	if code != 200 || resp["ok"] != true {
		t.Fatalf("manual_order_create: %d %v", code, resp)
	}
	code, body = get(t, base+"/panel/query?kind=orders&q=闲鱼买家A", "ptok")
	if code != 200 {
		t.Fatalf("orders query: %d %v", code, body)
	}
	rows := body["rows"].([]any)
	if len(rows) != 1 {
		t.Fatalf("联系方式模糊搜索应命中 1 行: %v", rows)
	}
	no := rows[0].([]any)[0].(string)
	code, body = get(t, base+"/panel/query?kind=order_codes&order_no="+no, "ptok")
	if code != 200 {
		t.Fatalf("order_codes: %d %v", code, body)
	}
	// 顶层键集合 ≡ 净屏扁平契约（单源=净屏 admin/panel.go order_codes 响应；平台
	// bp.js orderDetailHTML 读顶层字段）。嵌套 order{} 首版曾致详情头全 undefined
	// （2026-11-02 对齐），此断言防再漂移——改响应键必须两仓成对改。
	wantKeys := []string{"order_no", "status", "channel", "tag", "amount",
		"created_at", "paid_at", "delivered_at", "reduce_estimate",
		"codes", "devices", "events", "preset_tags", "actions"}
	if len(body) != len(wantKeys) {
		t.Fatalf("order_codes 顶层键数=%d want %d: %v", len(body), len(wantKeys), bodyKeys(body))
	}
	for _, k := range wantKeys {
		if _, ok := body[k]; !ok {
			t.Fatalf("order_codes 缺键 %s: %v", k, bodyKeys(body))
		}
	}
	// cfg 保存回读
	if code, resp := post(t, base+"/panel/action", "ptok", `{"action_id":"config_set","values":{"xianyu_item_url":"https://m.tb.cn/new","contact_url":"https://c","service_hours":"9:00-21:00","native_checkout":true}}`); code != 200 || resp["ok"] != true {
		t.Fatalf("cfg_save: %d %v", code, resp)
	}
	if st.Setting("xianyu_item_url") != "https://m.tb.cn/new" || st.Setting("native_checkout") != "1" {
		t.Fatalf("cfg 落库不符: %q %q", st.Setting("xianyu_item_url"), st.Setting("native_checkout"))
	}
	// 未开放 kind 显式报错（rulepack_content=净屏域）
	if code, _ := get(t, base+"/panel/query?kind=rulepack_content&app=shiyin", "ptok"); code != 400 {
		t.Fatalf("未开放 kind 应 400, got %d", code)
	}
}

// TestTrialSync 试用补单（SYTRIAL- 前缀+字段契约：金额 0/is_test/channel 空）+
// uid 视图豁免（七题回归反馈 2026-11-02）：试用单 delivered 经 uid 查询应带 codes
// （客户端「已完成」推断数据源）；正式单 uid 视图脱敏无码（TestOrderCenterLevels 锁）。
func TestTrialSync(t *testing.T) {
	base, _, st := newTestServer(t)
	cronSync(t, st)
	o, err := st.GetOrder("SYTRIAL-000001")
	if err != nil {
		t.Fatalf("试用单未建: %v", err)
	}
	if o.Amount != 0 || !o.IsTest || o.Channel != "" || o.UID != "dev-t1" ||
		o.Tag != "自动试用" || o.SKU != "auto3" || len(o.PoolIDs) != 1 {
		t.Fatalf("试用单字段不符: %+v", o)
	}
	// uid 视图豁免：试用单带码（full 仍 false=单号仍脱敏）。新测试库 uid=dev-t1
	// 仅试用单一行（脱敏号形如 SY****0001，取唯一行断言）
	_, body := get(t, base+"/api/orders?uid=dev-t1", "")
	orders := body["orders"].([]any)
	if len(orders) != 1 {
		t.Fatalf("uid 列表应恰试用单一行: %v", orders)
	}
	trial := orders[0].(map[string]any)
	if trial["full"] != false {
		t.Fatalf("试用单 uid 视图 full 应 false: %v", trial)
	}
	codes, _ := trial["codes"].([]any)
	if len(codes) == 0 {
		t.Fatalf("试用单 uid 视图应豁免下发 codes: %v", trial)
	}
}

// cronSync 经 cron 包单轮入口补单（避免 import 环直接闭包调用——cron.SyncTrialOrders
// 与本测试同语义）。
func cronSync(t *testing.T, st *store.Store) {
	t.Helper()
	if _, err := st.SyncTrialOrders(); err != nil {
		t.Fatalf("trial sync: %v", err)
	}
}

// TestTrialOrderCreateCallback 平台 claim 即时回调载荷契约锁（批2 代码审 C1 回归：
// 平台 trial.go notifyTrialOrder 实发 {"grant_id":<int64 number>,"device_id","key_id"}
// ——键名/JSON number 双形态，原读 "id"+.(string) 恒失败静默退化纯 cron）。
func TestTrialOrderCreateCallback(t *testing.T) {
	base, _, st := newTestServer(t)
	code, resp := post(t, base+"/panel/action", "ptok",
		`{"action_id":"trial_order_create","values":{"grant_id":2,"device_id":"dev-t2","key_id":"SY-TRIAL-2"}}`)
	if code != 200 || resp["ok"] != true {
		t.Fatalf("平台载荷回调应成功: %d %v", code, resp)
	}
	o, err := st.GetOrder("SYTRIAL-000002")
	if err != nil {
		t.Fatalf("即时路未建单: %v", err)
	}
	if o.UID != "dev-t2" || o.Tag != "自动试用" {
		t.Fatalf("试用单字段不符: %+v", o)
	}
	// 重放幂等（平台重试/双发安全）
	if code, resp := post(t, base+"/panel/action", "ptok",
		`{"action_id":"trial_order_create","values":{"grant_id":2,"device_id":"dev-t2","key_id":"SY-TRIAL-2"}}`); code != 200 || resp["ok"] != true {
		t.Fatalf("重放应幂等: %d %v", code, resp)
	}
}

// TestSkusEmptyCache503 缓存为空=503（App 端非 2xx 保留旧缓存——净屏 I-8 同款
// 语义锚点；恒 200 空数组会把旧缓存覆盖为空）。
func TestSkusEmptyCache503(t *testing.T) {
	fp := fakePlatform(map[string][]string{})
	defer fp.Close()
	st, err := store.Open(filepath.Join(t.TempDir(), "empty.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	st.SetSRV(osrv.New(fp.URL, "tok", ProductID)) // 不 seed——模拟 srv 从未拉到
	srv := &Server{St: st}
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()
	if code, _ := get(t, ts.URL+"/api/skus", ""); code != 503 {
		t.Fatalf("空缓存应 503, got %d", code)
	}
}

// TestNativeCheckoutDisabled409 应急开关：native_checkout=0 → 下单 409
// （回滚清单核心一环；关 flag 后持旧缓存设备仍会被服务端拦截）。
func TestNativeCheckoutDisabled409(t *testing.T) {
	base, _, st := newTestServer(t)
	if err := st.SettingSet("native_checkout", "0"); err != nil {
		t.Fatal(err)
	}
	if code, _ := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev1","client_token":"t0"}`); code != 409 {
		t.Fatalf("关 flag 下单应 409, got %d", code)
	}
}

// TestRateLimit429 IP 限频：5 单后第 6 单 429（X-Real-IP 可信头优先——伪造 XFF
// 首段不影响限频键，批2 代码审 I-2 回归）。
func TestRateLimit429(t *testing.T) {
	base, _, _ := newTestServer(t)
	// 网关形态镜像：每请求带 X-Real-IP（nginx set_header 不可伪造层）
	for i := 0; i < 5; i++ {
		req, _ := http.NewRequest(http.MethodPost, base+"/api/order/create",
			strings.NewReader(`{"sku":"shiyin-m1","uid":"dev-x","client_token":"tl`+strconv.Itoa(i)+`"}`))
		req.Header.Set("X-Real-IP", "1.2.3.4")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("第 %d 单应成功, got %d", i+1, resp.StatusCode)
		}
	}
	req, _ := http.NewRequest(http.MethodPost, base+"/api/order/create",
		strings.NewReader(`{"sku":"shiyin-m1","uid":"dev-x","client_token":"tl5"}`))
	req.Header.Set("X-Real-IP", "1.2.3.4")
	req.Header.Set("X-Forwarded-For", "9.9.9.9") // 伪造 XFF 首段不得绕过（X-Real-IP 优先）
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 429 {
		t.Fatalf("伪造 XFF 后仍应 429, got %d", resp.StatusCode)
	}
}

// TestReconcile cron 补发+48h 关单（批2 代码审 I2⑤）：pending 超时→closed+
// timeout_close 事件；paid 未发货→重试补发。
func TestReconcile(t *testing.T) {
	base, _, st := newTestServer(t)
	// 48h 关单：建单回退 created_at
	_, b := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev-r","client_token":"tr1"}`)
	no := b["order_no"].(string)
	old := time.Now().Add(-49 * time.Hour).Unix()
	if _, err := st.DB().Exec(`UPDATE orders SET created_at=? WHERE order_no=?`, old, no); err != nil {
		t.Fatal(err)
	}
	cron.Reconcile(st)
	o, err := st.GetOrder(no)
	if err != nil || o.Status != "closed" {
		t.Fatalf("超时单应 closed: %+v err=%v", o, err)
	}
	if len(o.Events) == 0 || o.Events[len(o.Events)-1].Kind != "timeout_close" {
		t.Fatalf("应补 timeout_close 事件: %+v", o.Events)
	}
	// paid 补发：建单→确认收款（fake 平台划码）→人为清 pool_ids 模拟池空遗留→补发回填
	_, b2 := post(t, base+"/api/order/create", "", `{"sku":"shiyin-m1","uid":"dev-r","client_token":"tr2"}`)
	no2 := b2["order_no"].(string)
	if code, resp := post(t, base+"/panel/action", "ptok", `{"action_id":"confirm_paid","values":{"order_no":"`+no2+`","actual_cents":"499"}}`); code != 200 || resp["ok"] != true {
		t.Fatalf("confirm: %d %v", code, resp)
	}
	// 模拟池空遗留：退回 paid+清 pool_ids（delivered 不在补发面）
	if _, err := st.DB().Exec(`UPDATE orders SET status='paid', pool_ids='[]' WHERE order_no=?`, no2); err != nil {
		t.Fatal(err)
	}
	cron.Reconcile(st)
	o2, err := st.GetOrder(no2)
	if err != nil || len(o2.PoolIDs) == 0 {
		t.Fatalf("补发应回填码: %+v err=%v", o2, err)
	}
}

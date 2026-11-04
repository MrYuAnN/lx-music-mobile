package com.shiyin.music.activation

// 批2 薄 RN bridge（方案 §三A.4 六方法，.review-bundle/2026-10-31/context-b2-plan.md）：
// 仅暴露 JS 侧必需的 SDK 面。试用领取/权益巡检/重装恢复全在 MainApplication 原生编排
// （净屏同款），不经此模块；JS 侧桥接见 src/utils/nativeModules/activation.ts。
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import top.astock.activation.ActivationSdk
import top.astock.activation.EntitlementManager
import top.astock.activation.EntitlementManager.AuthResult
import top.astock.activation.EntitlementManager.EntitlementChange
import top.astock.activation.EntitlementManager.State

class ShiyinActivationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "ShiyinActivation"

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  // 权益事件转发席（审计 A-7，净屏 HomeActivity 生命周期席对齐）：后台 claim 到账/
  // 重装恢复后 RN 界面自动刷新。与 MainApplication 原生 toast 席并存（SDK listener 为
  // 列表注册）；reload 重建模块时必须注销，防死 lambda 累积（下次 emit 崩溃）。
  private val entitlementListener: (EntitlementChange) -> Unit = { change ->
    try {
      reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(ENTITLEMENT_CHANGED_EVENT, change.name)
    } catch (_: IllegalStateException) {
      // emit 与 invalidate 的竞态窗口（context 已失效）——事件丢弃，下次挂载 refresh 兜底
    }
  }

  init {
    EntitlementManager.registerEntitlementListener(entitlementListener)
  }

  override fun invalidate() {
    EntitlementManager.unregisterEntitlementListener(entitlementListener)
    super.invalidate()
  }

  // 本产品 app 键（=productId，Entitlement.expiries 的 key）
  private val appKey: String get() = ActivationSdk.productId

  @ReactMethod
  fun getDeviceId(promise: Promise) {
    try {
      promise.resolve(EntitlementManager.deviceId(reactContext))
    } catch (e: Exception) {
      promise.reject("device_id", e.message, e)
    }
  }

  @ReactMethod
  fun getStoredKey(promise: Promise) {
    try {
      promise.resolve(EntitlementManager.storedKey(reactContext))
    } catch (e: Exception) {
      promise.reject("stored_key", e.message, e)
    }
  }

  // 激活/续费/重绑（SDK activateOrRedeem 单入口）。userMessage 为 SDK 本地化文案直接可用，
  // RN 侧不重复映射（协议判定走 errCode，文案协议解耦对齐 SDK 审查 I2）。
  // merge=多码融合确认后透传（审计 A-2，净屏 JingpingSheets#doActivate 对齐）——服务端
  // 对换码是无条件融合+烧毁旧码，RN 侧确认弹窗在前、此处仅透传决定
  @ReactMethod
  fun activate(input: String, merge: Boolean, promise: Promise) {
    scope.launch {
      try {
        when (val r = EntitlementManager.activateOrRedeem(reactContext, input, merge)) {
          is AuthResult.Success -> promise.resolve(result(ok = true, message = "", errCode = null))
          is AuthResult.Failure -> promise.resolve(result(ok = false, message = r.userMessage, errCode = r.errCode))
        }
      } catch (e: Exception) {
        promise.reject("activate", e.message, e)
      }
    }
  }

  // 本机全部在绑码键集（多码，审计 A-2 融合确认前置判定用；SDK keyEntries 键列）
  @ReactMethod
  fun getKeys(promise: Promise) {
    try {
      promise.resolve(EntitlementManager.keyEntries(reactContext).map { it.first })
    } catch (e: Exception) {
      promise.reject("get_keys", e.message, e)
    }
  }

  // 码卡列表六字段（KeyInfo 页）：到期（0=永久）/expiries 全集（2026-11-01 净屏式生效范围行——
  // 按源收费口径码卡逐源行展示；app 键→到期 unix 秒）/试用标/绑定标记（本地 SP 读，null=本机
  // 在绑——三态即时渲染初值）/设备限额（「已绑 n/limit 台」数据源）。expiry 单值保留（兼容）
  @ReactMethod
  fun getKeyEntries(promise: Promise) {
    try {
      val entries = Arguments.createArray()
      // T4 件7：每码真值单源——validKeys（SDK validAt 判定）/maskedExpiries（遮蔽视图）
      // 随条目下发，码卡排序/分组不再自算时间比较
      val truths = EntitlementManager.entryTruths(reactContext).associateBy { it.keyId }
      EntitlementManager.keyEntries(reactContext).forEach { (key, e) ->
        val m: WritableMap = Arguments.createMap()
        m.putString("key", key)
        val expiriesMap = Arguments.createMap()
        e.expiries.forEach { (app, exp) -> expiriesMap.putDouble(app, exp.toDouble()) }
        m.putMap("expiries", expiriesMap)
        m.putDouble("expiry", (e.expiries[appKey] ?: 0L).toDouble())
        m.putBoolean("isTrial", e.isTrial())
        val mark = EntitlementManager.bindingState(reactContext, key)
        if (mark != null) m.putString("mark", mark) else m.putNull("mark")
        m.putInt("deviceLimit", e.deviceLimit)
        val truth = truths[key]
        if (truth != null) {
          val validArr = Arguments.createArray()
          truth.validKeys.forEach { validArr.pushString(it) }
          m.putArray("validKeys", validArr)
          val maskedMap = Arguments.createMap()
          truth.masked.expiries.forEach { (app, exp) -> maskedMap.putDouble(app, exp.toDouble()) }
          m.putMap("maskedExpiries", maskedMap)
        } else {
          m.putNull("validKeys"); m.putNull("maskedExpiries")
        }
        entries.pushMap(m)
      }
      promise.resolve(entries)
    } catch (e: Exception) {
      promise.reject("get_key_entries", e.message, e)
    }
  }

  // 按码绑定态网络校验（/api/binding-check，RN 侧 60s/码节流）：mark+在绑设备列表
  // （deviceId 完整盐化哈希仅持码可见，RN 展示尾段截断）
  @ReactMethod
  fun getBindingInfo(key: String, promise: Promise) {
    scope.launch {
      try {
        val info = EntitlementManager.bindingCheckNow(reactContext, key)
        val m: WritableMap = Arguments.createMap()
        val mark = info.mark
        if (mark != null) m.putString("mark", mark) else m.putNull("mark")
        val devices = Arguments.createArray()
        info.devices.forEach { d ->
          val dm: WritableMap = Arguments.createMap()
          dm.putString("deviceId", d.deviceId)
          dm.putString("deviceName", d.deviceName)
          dm.putDouble("boundAt", d.boundAt.toDouble())
          dm.putBoolean("isSelf", d.isSelf)
          devices.pushMap(dm)
        }
        m.putArray("devices", devices)
        promise.resolve(m)
      } catch (e: Exception) {
        promise.reject("get_binding_info", e.message, e)
      }
    }
  }

  // 远程解绑他机（SDK v1.4 结构化：errCode 供 RN i18n，message 中文兜底）
  @ReactMethod
  fun releaseRemote(key: String, deviceId: String, promise: Promise) {
    scope.launch {
      try {
        val r = EntitlementManager.releaseRemoteEx(reactContext, key, deviceId)
        promise.resolve(result(ok = r.ok, message = if (r.ok) "" else r.userMessage, errCode = r.errCode))
      } catch (e: Exception) {
        promise.reject("release_remote", e.message, e)
      }
    }
  }

  // 解绑本机（方案 F.4+KeyInfo 按码）：key 空串=解主 key（兼容默认调用）；SDK v1.4 结构化
  // 返回（errCode 供 RN i18n）。成功后 JS 侧负责凭证分支清理（仅无在绑码才断取链链路）
  @ReactMethod
  fun releaseDevice(key: String, promise: Promise) {
    scope.launch {
      try {
        val r = EntitlementManager.releaseDeviceEx(reactContext, key.ifEmpty { null })
        promise.resolve(result(ok = r.ok, message = if (r.ok) "" else r.userMessage, errCode = r.errCode))
      } catch (e: Exception) {
        promise.reject("release_device", e.message, e)
      }
    }
  }

  // 激活态快照：{state, expiry, expiries, isTrial, key, valid?, masked?, primary?}。
  // expiry=本 app 到期 unix 秒（0=永久，null=无权益）；expiries=生效范围全集（app 键→
  // 到期，净屏 entitlementRows 口径；Home 横幅多源「最早到期 app 归因」数据源，净屏审查
  // I8 同语义，2026-11-01 用户多源提示需求）。
  // T4 件7（2026-11-04）：Active/Expired 追加每键真值 valid（app→bool，SDK validAt+
  // effectiveNow 口径）/遮蔽视图 masked（兜底有效时只留兜底键）/选主 primary
  // （码卡主行新语义）——RN 展示层不自算时间比较（判定族单源化，拍板 #2/#7）；
  // Unactivated 三字段 null。
  @ReactMethod
  fun getState(promise: Promise) {
    try {
      val map: WritableMap = Arguments.createMap()
      when (val s = EntitlementManager.current(reactContext)) {
        is State.Unactivated -> {
          map.putString("state", "unactivated")
          map.putNull("expiry")
          map.putNull("expiries")
          map.putBoolean("isTrial", false)
          map.putNull("valid")
          map.putNull("masked")
          map.putNull("primary")
        }
        is State.Active -> {
          map.putString("state", "active")
          map.putDouble("expiry", (s.e.expiries[appKey] ?: 0L).toDouble())
          val all: WritableMap = Arguments.createMap()
          for ((app, exp) in s.e.expiries) all.putDouble(app, exp.toDouble())
          map.putMap("expiries", all)
          map.putBoolean("isTrial", s.e.isTrial())
          putTruth(map)
        }
        is State.Expired -> {
          map.putString("state", "expired")
          map.putDouble("expiry", (s.e.expiries[appKey] ?: 0L).toDouble())
          val all: WritableMap = Arguments.createMap()
          for ((app, exp) in s.e.expiries) all.putDouble(app, exp.toDouble())
          map.putMap("expiries", all)
          map.putBoolean("isTrial", s.e.isTrial())
          putTruth(map)
        }
      }
      map.putString("key", EntitlementManager.storedKey(reactContext))
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("get_state", e.message, e)
    }
  }

  /** T4 件7：valid/masked/primary 三字段下发（SDK mergedTruth/primarySelection 单源） */
  private fun putTruth(map: WritableMap) {
    val truth = EntitlementManager.mergedTruth(reactContext)
    if (truth == null) {
      map.putNull("valid"); map.putNull("masked"); map.putNull("primary")
      return
    }
    val validMap: WritableMap = Arguments.createMap()
    for ((app, v) in truth.valid) validMap.putBoolean(app, v)
    map.putMap("valid", validMap)
    val maskedMap: WritableMap = Arguments.createMap()
    for ((app, exp) in truth.masked) maskedMap.putDouble(app, exp.toDouble())
    map.putMap("masked", maskedMap)
    val sel = EntitlementManager.primarySelection(reactContext)
    if (sel == null) {
      map.putNull("primary")
    } else {
      val pm: WritableMap = Arguments.createMap()
      pm.putString("key", sel.keyId)
      val pe: WritableMap = Arguments.createMap()
      for ((app, exp) in sel.ent.expiries) pe.putDouble(app, exp.toDouble())
      pm.putMap("expiries", pe)
      map.putMap("primary", pm)
    }
  }

  // 首启试用资格待弹标志消费（读+清，SDK 幂等）：RN 侧 AppState active 每次前台消费
  // （审查 N3，净屏 onResume 双入口等价——claim 在途返 false 不清，下个前台再试）
  @ReactMethod
  fun consumeTrialWelcomePending(promise: Promise) {
    try {
      promise.resolve(EntitlementManager.consumeTrialWelcome(reactContext))
    } catch (e: Exception) {
      promise.reject("consume_welcome", e.message, e)
    }
  }

  private fun result(ok: Boolean, message: String, errCode: String?): WritableMap {
    val map: WritableMap = Arguments.createMap()
    map.putBoolean("ok", ok)
    map.putString("message", message)
    if (errCode != null) map.putString("errCode", errCode) else map.putNull("errCode")
    return map
  }

  companion object {
    // 事件名按项目 NativeEventEmitter 先例用 kebab-case（lyricDesktop 'set-position' 同款）
    const val ENTITLEMENT_CHANGED_EVENT = "entitlement-changed"
  }
}

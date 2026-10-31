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

  // 解绑本机（方案 F.4）：成功后 JS 侧负责清取链 token（删 AUTH_KEY）与未激活态引导
  @ReactMethod
  fun releaseDevice(promise: Promise) {
    scope.launch {
      try {
        val r = EntitlementManager.releaseDevice(reactContext)
        r.fold(
          onSuccess = { promise.resolve(result(ok = true, message = "", errCode = null)) },
          onFailure = { promise.resolve(result(ok = false, message = it.message ?: "", errCode = null)) },
        )
      } catch (e: Exception) {
        promise.reject("release_device", e.message, e)
      }
    }
  }

  // 激活态快照：{state, expiry, isTrial, key}。expiry=本 app 到期 unix 秒（0=永久，null=无权益）
  @ReactMethod
  fun getState(promise: Promise) {
    try {
      val map: WritableMap = Arguments.createMap()
      when (val s = EntitlementManager.current(reactContext)) {
        is State.Unactivated -> {
          map.putString("state", "unactivated")
          map.putNull("expiry")
          map.putBoolean("isTrial", false)
        }
        is State.Active -> {
          map.putString("state", "active")
          map.putDouble("expiry", (s.e.expiries[appKey] ?: 0L).toDouble())
          map.putBoolean("isTrial", s.e.isTrial())
        }
        is State.Expired -> {
          map.putString("state", "expired")
          map.putDouble("expiry", (s.e.expiries[appKey] ?: 0L).toDouble())
          map.putBoolean("isTrial", s.e.isTrial())
        }
      }
      map.putString("key", EntitlementManager.storedKey(reactContext))
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("get_state", e.message, e)
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

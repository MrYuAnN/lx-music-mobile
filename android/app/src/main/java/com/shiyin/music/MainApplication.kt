package com.shiyin.music

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

import com.shiyin.music.activation.ShiyinActivationPackage
import com.shiyin.music.cache.CachePackage
import com.shiyin.music.crypto.CryptoPackage
import com.shiyin.music.download.DownloadPackage
import com.shiyin.music.lyric.LyricPackage
import com.shiyin.music.scheduler.ExpiryReminderScheduler
import com.shiyin.music.utils.UtilsPackage

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

import top.astock.activation.ActivationSdk
import top.astock.activation.EntitlementManager
import top.astock.activation.EntitlementSyncScheduler

import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.concurrent.thread

// N2：0.86 模板（ReactHost + loadReactNative，取代 ReactNativeHost 体系）；
// 自研六模块手动注册自 N1 平移，interop 装机验证
class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(CachePackage())
          add(LyricPackage())
          add(UtilsPackage())
          add(CryptoPackage())
          add(DownloadPackage())
          add(ShiyinActivationPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // F-1 全段度量原生段佐证（拍板⑥，审查 C-1）：tag=ShiyinBoot，探针=adb logcat -s ShiyinBoot
    Log.i(BOOT_TAG, "native onCreate start")
    initActivationSdk()
    loadReactNative(this)
    preconnectShiyinHost()
    Log.i(BOOT_TAG, "native onCreate end")
  }

  // 批2 激活编排（净屏 RethinkDnsApplication 逐项同款；实施单源 .review-bundle/2026-10-31/
  // context-b2-plan.md §三A）。同步段三件必须先于 loadReactNative 与权益协程：
  // init 同步段=SDK README 硬约束（apiBase/公钥空窗）；listener 先于 claim 协程=审查 N1
  // （claim 内部 409→restore 同步遍历通知，链尾注册必丢「已恢复」toast）；pending 判定
  // 先于 claim=净屏时序拍板（「receipts 空」锚被 claim 落库污染则慢机型漏弹竞态）。
  private fun initActivationSdk() {
    ActivationSdk.init(
      apiBase = BuildConfig.SDK_API_BASE,
      productId = BuildConfig.SDK_PRODUCT_ID,
      deviceSalt = BuildConfig.SDK_DEVICE_SALT,
      servicePubkeyHex = BuildConfig.SDK_SERVICE_PUBKEY_HEX,
      xClientVersion = BuildConfig.VERSION_NAME,
      // install 活跃上报开启（2026-11-03 拍板，推翻批2 S6 关闭）：关闭理由「网关无
      // /app 分流=全量 404 丽数」随七题 SDK 域直连拍板（2026-11-02）失效——
      // api.a-stock.top 兜底 location / 直转 platform-server（jingping-api.conf:146），
      // 零写入探针实证路由通（2026-11-03 线上 400 bad_request=端点在线）。看板
      // 「安装设备（版本/首启/最近活跃）」数据源，SDK 接入清单【放量】项接线
      installReportEnabled = true,
    )
    // RESTORED→「已恢复本机激活」toast（净屏 :193 同款常驻席：启动 restore 先行命中，或
    // 试用 claim 命中 409 trial_has_license 时 SDK 内部自动导航 restore 找回，找回成功即通知）
    EntitlementManager.registerEntitlementListener { change ->
      if (change == EntitlementManager.EntitlementChange.RESTORED) {
        runCatching {
          Handler(Looper.getMainLooper()).post {
            Toast.makeText(this, R.string.activation_restored_toast, Toast.LENGTH_SHORT).show()
          }
        }
      }
    }
    // 首启试用资格待弹标志（净屏 :187 同款）：同步判定先于 claim；RN 侧经
    // consumeTrialWelcomePending 消费（AppState active 每次前台，审查 N3）
    EntitlementManager.markTrialWelcomePendingIfEligible(this)
    // D2 双调度（2026-11-01 拍板：原生 WorkManager 整套；旧「不接 6h 巡检 Worker」
    // 落字作废，权益止损窗口 TTL≤24h→6h）：SDK 6h 巡检（refreshOnStart/claimTrial
    // 重试兜底，CONNECTED 约束）+ 宿主 24h 到期本地提醒（读本地 Receipt 零服务端
    // 依赖）。均幂等不重复入队；Worker 内 enforceExpiry 因宿主未注册
    // onAppNotEntitled 钩子空跑（SDK `?: return`），到期处置维持取链 403→重注册
    // 快速失败链（SDK「钩子未注册=宿主只消费 State 自行判定亦合法」）
    EntitlementSyncScheduler.schedule(this)
    ExpiryReminderScheduler.schedule(this)
    // 权益启动协程（净屏 :232-243 同款）：巡检刷新 → 未激活先 restore 按设备锚找回（claim
    // 调用契约「restore 先行」的宿主侧落实——正价重装召回不再单点依赖 claim 409 分支，
    // trial_min_client_ver 门槛 426 掐断试用链时召回链仍通）→ 首启自动领 3 天试用
    // （Unactivated 才领，SDK 内部幂等+退避节流；失败静默，无网首启联网后自动开始）。
    // 仍不接（落字，审查 S6/复审）：enforceExpiry 宿主钩子（拾音到期处置=取链 403→
    // 重注册快速失败链承担，见上 D2 注）、PlanSkus.fetch（已核实 claim 直连
    // /api/trial-claim 不依赖 SKU 缓存，fetch 属净屏 SKU 展示面）
    appScope.launch {
      try {
        EntitlementManager.refreshOnStart(this@MainApplication)
        if (EntitlementManager.current(this@MainApplication) is EntitlementManager.State.Unactivated) {
          EntitlementManager.restoreFromDevice(this@MainApplication)
        }
        EntitlementManager.claimTrial(this@MainApplication)
      } catch (e: Exception) {
        Log.w(BOOT_TAG, "activation startup failed: ${e.message}")
      }
    }
    // install 活跃上报接线（SDK「每次回前台 fire-and-forget 上报」的宿主侧落实；
    // 批2 接入时未挂此调用）：单 Activity 架构下 onActivityResumed=回前台（应用内
    // 导航不触发，天然对齐 SDK 语义）；appScope 异步零 await（F-1 闸门纪律同款——
    // 启动/回前台路径永不依赖网络），SDK 内 upsert 幂等+失败静默；频率=回前台次数，
    // 服务端 install 桶 300 次/IP/日（per-product 独立桶；触顶=429 静默、last_seen
    // 次日自愈）——回前台频率下单设备富余
    registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
      override fun onActivityResumed(activity: Activity) {
        appScope.launch { EntitlementManager.reportInstall(this@MainApplication) }
      }
      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
      override fun onActivityStarted(activity: Activity) {}
      override fun onActivityPaused(activity: Activity) {}
      override fun onActivityStopped(activity: Activity) {}
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
      override fun onActivityDestroyed(activity: Activity) {}
    })
  }

  // 权益启动协程域（进程生命周期；独立于 RN 吐司线程）
  private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  // F-1 原生预连接·保守版（doc/plans/instant-open.md §二.3）：DNS 预解析 + TCP 预热，严格
  // 后台 daemon 线程失败静默防 ANR（R4）。收益边界（F-1 审查 I-5 修订）：DNS 预解析=确定收益；
  // 裸 Socket 连后即关**不进任何连接池**，TCP 握手/TLS 仍在 JS 侧 OkHttp 首请求——主流
  // preconnect 均为保连接复用形态（Chrome preconnect/Lighthouse），本实现为保守版自定形态
  // （不动 OkHttpClientProvider 约束），DNS/TCP 拆分耗时即 HTTPDNS 立项判据数据。
  // 域名与 src/core/shiyin/config.ts SHIYIN_BASE_URL 双源——换域名须同改两处。
  private fun preconnectShiyinHost() {
    thread(name = "shiyin-preconnect", isDaemon = true) {
      try {
        val dnsStart = System.currentTimeMillis()
        val address = InetAddress.getByName(SHIYIN_HOST)
        Log.i(BOOT_TAG, "preconnect dns ok +${System.currentTimeMillis() - dnsStart}ms")
        val tcpStart = System.currentTimeMillis()
        Socket().use { it.connect(InetSocketAddress(address, 443), PRECONNECT_TIMEOUT_MS) }
        Log.i(BOOT_TAG, "preconnect tcp ok +${System.currentTimeMillis() - tcpStart}ms")
      } catch (e: Exception) {
        Log.i(BOOT_TAG, "preconnect failed: ${e.message}")
      }
    }
  }

  companion object {
    private const val BOOT_TAG = "ShiyinBoot"
    // 双源：src/core/shiyin/config.ts SHIYIN_BASE_URL（换域名须同改）；
    // 2026-11-03 音乐域直连批：shiyinbox.top（EdgeOne）→ sy-api.a-stock.top（直连）
    private const val SHIYIN_HOST = "sy-api.a-stock.top"
    private const val PRECONNECT_TIMEOUT_MS = 5_000
  }
}

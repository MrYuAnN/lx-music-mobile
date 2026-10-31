package com.shiyin.music

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

import com.shiyin.music.cache.CachePackage
import com.shiyin.music.crypto.CryptoPackage
import com.shiyin.music.download.DownloadPackage
import com.shiyin.music.lyric.LyricPackage
import com.shiyin.music.utils.UtilsPackage

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
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // F-1 全段度量原生段佐证（拍板⑥，审查 C-1）：tag=ShiyinBoot，探针=adb logcat -s ShiyinBoot
    Log.i(BOOT_TAG, "native onCreate start")
    loadReactNative(this)
    preconnectShiyinHost()
    Log.i(BOOT_TAG, "native onCreate end")
  }

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
    // 双源：src/core/shiyin/config.ts SHIYIN_BASE_URL（换域名须同改）
    private const val SHIYIN_HOST = "shiyinbox.top"
    private const val PRECONNECT_TIMEOUT_MS = 5_000
  }
}

package com.shiyin.music

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

// N1：标准 ReactActivity（组件名=app.json "shiyin"）；N2：0.86 模板简化，
// MF-4 手动 edge-to-edge 兜底退役（edgeToEdgeEnabled=true 由 RN 接管）
class MainActivity : ReactActivity() {

  /** Returns the name of the main component registered from JavaScript. */
  override fun getMainComponentName(): String = "shiyin"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flag [fabricEnabled].
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // F-1 无白屏（拍板 A）：splash 保持到内容就绪——install 必须先于 super.onCreate；
    // JS containerReady 经 UtilsModule.notifyContentReady() 解除，3s 保险丝防 JS 异常/
    // 桥未通时卡死 splash（卡图标比白屏一闪更糟）
    // 注意：必须接住 androidx 返回实例——裸 `splashScreen` 会解析到 Activity.getSplashScreen()
    // （android.window 平台类，无 keep-on-screen 能力）
    val coreSplash = installSplashScreen()
    super.onCreate(savedInstanceState)
    coreSplash.setKeepOnScreenCondition { !contentReady }
    Handler(Looper.getMainLooper()).postDelayed({ contentReady = true }, CONTENT_READY_FALLBACK_MS)
  }

  // UtilsModule.notifyContentReady() 调用入口
  fun markContentReady() {
    contentReady = true
  }

  companion object {
    // 进程级标志：温启动保持 true 不重置（JS 不重跑 containerReady，重置会白等 3s 保险丝）；
    // 冷启动进程新建自动归 false
    @Volatile
    var contentReady: Boolean = false
      private set

    private const val CONTENT_READY_FALLBACK_MS = 3_000L
  }
}

package com.shiyin.music

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

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
}

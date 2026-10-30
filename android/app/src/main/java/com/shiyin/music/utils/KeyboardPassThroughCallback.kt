package com.shiyin.music.utils

import android.content.Context
import android.graphics.Rect
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.Window
import android.view.inputmethod.InputMethodManager
import android.widget.EditText

/**
 * Dialog 窗口触摸放行包装（键盘弹着首击实验，2026-10-19，doc/plans/modal-wrap-content-window.md）：
 * HyperOS 键盘弹着时把输入框外首击在更早层级征用收键盘（真机实证 touch 不进 RN，onPressIn
 * 均不触发）。本包装在窗口 callback 层复刻原生社区标准模式（SO 4165414）：ACTION_DOWN 时
 * 焦点在 EditText 且点击在其外 → 自行收键盘（clearFocus + hideSoftInputFromWindow）但
 * 不消费事件（delegate.dispatchTouchEvent 放行）——若事件确实到达本窗口，收键盘与点击一击
 * 完成；若 SheetInputProbe 无 DOWN 记录则事件在系统层（InputDispatcher/PolicyMaker）已被吞，
 * app 侧无解（转小窗形态方案 doc/plans/modal-wrap-content-window.md）。
 */
class KeyboardPassThroughCallback(
  private val delegate: Window.Callback,
  private val decorView: View,
) : Window.Callback by delegate {

  override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
    if (ev.action == MotionEvent.ACTION_DOWN) {
      val focus = decorView.findFocus()
      if (focus is EditText) {
        val r = Rect()
        // getGlobalVisibleRect=false = view 未 attach/不可见：按窗外处理（语义化，三席审查 S-3）
        val visible = focus.getGlobalVisibleRect(r)
        if (visible && r.contains(ev.rawX.toInt(), ev.rawY.toInt())) {
          if (PROBE_LOG) Log.i(PROBE_TAG, "DOWN inside input (${ev.rawX.toInt()},${ev.rawY.toInt()})")
        } else {
          if (PROBE_LOG) Log.i(PROBE_TAG, "DOWN outside input -> dismiss IME + pass through (${ev.rawX.toInt()},${ev.rawY.toInt()})")
          focus.clearFocus()
          val imm = decorView.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
          imm?.hideSoftInputFromWindow(focus.windowToken, 0)
        }
      } else if (PROBE_LOG) {
        Log.i(PROBE_TAG, "DOWN focus=${focus?.javaClass?.simpleName ?: "none"} (${ev.rawX.toInt()},${ev.rawY.toInt()})")
      }
    }
    return delegate.dispatchTouchEvent(ev)
  }

  companion object {
    private const val PROBE_TAG = "SheetInputProbe"
    // 探针日志门控（三席审查 S-1）：层级判决已定案，生产关噪；需再取证时临时置 true
    private const val PROBE_LOG = false
  }
}

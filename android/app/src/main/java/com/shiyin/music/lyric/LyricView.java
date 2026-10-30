package com.shiyin.music.lyric;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Display;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.OrientationEventListener;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 悬浮歌词窗口层（无底板重设计）：纯文字描边悬浮窗（D1）、92% 定宽（D8）、tap 呼出工具条（D4）、
// 拖边半隐（D6，位置存/状态不存）、锁定穿透（D5）。工具条生命周期与本窗口状态机绑定（审查 I6）。
public class LyricView implements View.OnTouchListener {
  LyricSwitchView textView = null;
  WindowManager windowManager = null;
  WindowManager.LayoutParams layoutParams = null;
  final private ReactApplicationContext reactContext;
  final private LyricEvent lyricEvent;

  private static final float NORMAL_WIDTH_PERCENT = 0.92f;
  private static final float DOCKED_WIDTH_PERCENT = 0.12f;
  private static final float DOCK_EDGE_THRESHOLD_DP = 24f;
  private static final float DOCKED_ALPHA = 0.25f;
  private static final long TAP_MAX_DURATION = 300L;

  private LyricToolbar toolbar = null;
  private boolean currentPlayState = false;

  private float lastX; //上一次位置的X.Y坐标
  private float lastY;
  private float nowX;  //当前移动位置的X.Y坐标
  private float nowY;
  private float tranX; //悬浮窗移动位置的相对值
  private float tranY;
  private float prevViewPercentageX = 0;
  private float prevViewPercentageY = 0;

  private float downX = 0;
  private float downY = 0;
  private long downTime = 0;
  private float preY = 0;

  private boolean isLock = false;
  private boolean isSingleLine = false;
  private boolean isShowToggleAnima = false;
  private boolean isDocked = false;
  private boolean dockedLeft = false;
  private boolean isViewAttached = false;
  private boolean isViewPaused = false;
  private String playedColor = "rgba(255, 255, 255, 1)";
  private float alpha = 1f;
  private float textSize = 18f;
  private int maxWidth = 0;
  private int maxHeight = 0;
  private int touchSlop = 0;
  private int dockEdgeThreshold = 0;

  private String currentLyric = "拾音 ^-^";
  private ArrayList<String> currentExtendedLyrics = new ArrayList<>();
  private String currentNextLyric = "";

  private int mLastRotation;
  private OrientationEventListener orientationEventListener = null;

  final Handler fixViewPositionHandler;
  final Handler mainHandler;
  final Runnable fixViewPositionRunnable = this::updateViewPosition;

  LyricView(ReactApplicationContext reactContext, LyricEvent lyricEvent) {
    this.reactContext = reactContext;
    this.lyricEvent = lyricEvent;
    mainHandler = new Handler(Looper.getMainLooper());
    fixViewPositionHandler = new Handler();
    touchSlop = ViewConfiguration.get(reactContext).getScaledTouchSlop();
    dockEdgeThreshold = (int) (DOCK_EDGE_THRESHOLD_DP * reactContext.getResources().getDisplayMetrics().density + 0.5f);
  }

  /** 屏灭恢复时刷新当前行（原实现来自误继承的 Activity 基类，重写为主线程 post） */
  public void runOnUiThread(Runnable runnable) {
    mainHandler.post(runnable);
  }

  private void listenOrientationEvent() {
    if (orientationEventListener == null) {
      orientationEventListener = new OrientationEventListener(reactContext, SensorManager.SENSOR_DELAY_NORMAL) {
        @Override
        public void onOrientationChanged(int orientation) {
          Display display = windowManager.getDefaultDisplay();
          int rotation = display.getRotation();
          if (rotation != mLastRotation) {
            // 旋转重算：工具条自动收起，避免跟随错位（方案 §4.2.2）
            dismissToolbar();
            fixViewPositionHandler.postDelayed(fixViewPositionRunnable, 300);
          }
          mLastRotation = rotation;
        }
      };
    }
    if (orientationEventListener.canDetectOrientation()) {
      orientationEventListener.enable();
    }
  }
  private void removeOrientationEvent() {
    if (orientationEventListener == null) return;
    orientationEventListener.disable();
  }

  private int getLayoutParamsFlags() {
    int flag = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
      WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;

    if (isLock) {
      flag = flag | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
    }

    return flag;
  }

  /**
   * update screen width and height
   * @return has updated
   */
  private boolean updateWH() {
    Display display = windowManager.getDefaultDisplay();
    Point size = new Point();
    display.getRealSize(size);
    if (maxWidth == size.x && maxHeight == size.y) return false;
    maxWidth = size.x;
    maxHeight = size.y;
    return true;
  }

  private void setLayoutParamsHeight() {
    if (textView == null || layoutParams == null) return;
    int height = textView.getTotalHeight();
    if (height > maxHeight - 100) height = maxHeight - 100;
    // 窗口高度直接由 layoutParams.height 生效；容器自身 wrap 子行，无需 view 层重复同步
    // （审查 C2：view 层强转 WindowManager.LayoutParams 会崩，已删）
    layoutParams.height = height;
  }

  private void fixViewPosition() {
    if (textView == null || layoutParams == null) return;
    int width = (int) (maxWidth * (isDocked ? DOCKED_WIDTH_PERCENT : NORMAL_WIDTH_PERCENT));
    if (layoutParams.width != width) {
      layoutParams.width = width;
      textView.setWidth(width);
    }

    int maxX = maxWidth - layoutParams.width;
    int x = (int) (maxWidth * prevViewPercentageX);
    if (x < 0) x = 0;
    else if (x > maxX) x = maxX;
    if (isDocked) x = dockedLeft ? 0 : maxX;
    if (layoutParams.x != x) layoutParams.x = x;

    setLayoutParamsHeight();

    int maxY = maxHeight - layoutParams.height;
    int y = (int) (maxHeight * prevViewPercentageY);
    if (y < 0) y = 0;
    else if (y > maxY) y = maxY;
    if (layoutParams.y != y) layoutParams.y = y;
  }

  private void updateViewPosition() {
    if (textView == null || layoutParams == null || windowManager == null) return;
    if (!updateWH()) return;

    fixViewPosition();

    windowManager.updateViewLayout(textView, layoutParams);
  }

  public void sendPositionEvent(float x, float y) {
    WritableMap params = Arguments.createMap();
    params.putDouble("x", x);
    params.putDouble("y", y);
    lyricEvent.sendEvent(lyricEvent.SET_VIEW_POSITION, params);
  }

  public void showLyricView(Bundle options) {
    isLock = options.getBoolean("isLock", isLock);
    isSingleLine = options.getBoolean("isSingleLine", isSingleLine);
    isShowToggleAnima = options.getBoolean("isShowToggleAnima", isShowToggleAnima);
    playedColor = options.getString("playedColor", playedColor);
    prevViewPercentageX = (float) options.getDouble("lyricViewX", 0f) / 100f;
    prevViewPercentageY = (float) options.getDouble("lyricViewY", 0f) / 100f;
    alpha = (float) options.getDouble("alpha", alpha);
    textSize = (float) options.getDouble("textSize", textSize);
    handleShowLyric();
    listenOrientationEvent();
  }
  public static int parseColor(String input) {
    if (input.startsWith("#")) return Color.parseColor(input);
    Pattern c = Pattern.compile("rgba? *\\( *(\\d+), *(\\d+), *(\\d+)(?:, *([\\d.]+))? *\\)");
    Matcher m = c.matcher(input);
    if (m.matches()) {
      int red = Integer.parseInt(m.group(1));
      int green = Integer.parseInt(m.group(2));
      int blue = Integer.parseInt(m.group(3));
      float a = 1;
      if (m.group(4) != null) a = Float.parseFloat(m.group(4));
      return Color.argb((int) (a * 255), red, green, blue);
    }
    return Color.parseColor("#000000");
  }

  private void createTextView() {
    textView = new LyricSwitchView(reactContext, isSingleLine, isShowToggleAnima);
    textView.setLyric(currentLyric, currentExtendedLyrics, currentNextLyric);

    textView.setTextColor(parseColor(playedColor));
    textView.setAlpha(isDocked ? DOCKED_ALPHA : alpha);
    textView.setTextSize(textSize);
    // 重建（切单行等）时同步外层 docked 态，防状态机分裂（审查 I3）
    textView.setDocked(isDocked);

    //监听 OnTouch 事件：拖动 / tap 呼出工具条 / 拖边半隐
    textView.setOnTouchListener(this);
  }
  private void handleShowLyric() {
    if (windowManager == null) {
      windowManager = (WindowManager) reactContext.getSystemService(Context.WINDOW_SERVICE);
      layoutParams = new WindowManager.LayoutParams();
    }

    if (textView != null && isViewAttached) {
      windowManager.removeView(textView);
    }
    dismissToolbar();

    //创建三行容器（无底板：全状态透明背景，可读性由文字描边+阴影保障，D1）
    createTextView();

    layoutParams.type = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ?
      WindowManager.LayoutParams.TYPE_SYSTEM_ALERT :
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;

    layoutParams.flags = getLayoutParamsFlags();
    if (isLock) {
      // 修复 Android 12 的穿透点击问题
      if (Build.VERSION.SDK_INT > Build.VERSION_CODES.R) {
        layoutParams.alpha = 0.8f;
      }
    } else if (Build.VERSION.SDK_INT > Build.VERSION_CODES.R) {
      layoutParams.alpha = 1.0f;
    }

    layoutParams.gravity = Gravity.TOP | Gravity.START;

    updateWH();

    layoutParams.width = (int) (maxWidth * NORMAL_WIDTH_PERCENT);
    textView.setWidth(layoutParams.width);
    setLayoutParamsHeight();

    layoutParams.x = (int) (maxWidth * prevViewPercentageX);
    layoutParams.y = (int) (maxHeight * prevViewPercentageY);

    fixViewPosition();

    layoutParams.format = PixelFormat.TRANSPARENT;

    windowManager.addView(textView, layoutParams);
    isViewAttached = true;
    isViewPaused = false;
    isDocked = false;

    if (toolbar == null) toolbar = new LyricToolbar(reactContext, lyricEvent);
    toolbar.setPlayState(currentPlayState);
    toolbar.setTextSizeState(textSize);
  }

  public void setLyric(String text, ArrayList<String> extendedLyrics, String nextText) {
    // 三元组全等去重：next 行单独变化不得被跳过（审查 S14）
    if (text.equals(currentLyric) && extendedLyrics.equals(currentExtendedLyrics) && nextText.equals(currentNextLyric)) return;
    currentLyric = text;
    currentExtendedLyrics = extendedLyrics;
    currentNextLyric = nextText;
    if (textView == null) return;
    int oldHeight = textView.getTotalHeight();
    textView.setLyric(text, extendedLyrics, nextText);
    // 副行显隐变化 → 窗口高度重算（审查 C3：翻译/下一句行出现时防裁切）
    if (textView.getTotalHeight() != oldHeight) {
      setLayoutParamsHeight();
      if (isViewAttached) windowManager.updateViewLayout(textView, layoutParams);
      repositionToolbar();
    }
  }

  @Override
  public boolean onTouch(View v, MotionEvent event) {
    switch (event.getAction()) {
      case MotionEvent.ACTION_DOWN:
        lastX = event.getRawX();
        lastY = event.getRawY();
        downX = lastX;
        downY = lastY;
        downTime = SystemClock.uptimeMillis();
        preY = lastY;
        break;
      case MotionEvent.ACTION_MOVE:
        // docked 细条直接拖走：恢复 normal 后继续跟随手指
        if (isDocked) unDock();
        nowX = event.getRawX();
        nowY = event.getRawY();
        if (preY == 0) {
          preY = nowY;
        }
        tranX = nowX - lastX;
        tranY = nowY - lastY;

        int maxX = maxWidth - layoutParams.width;
        int maxY = maxHeight - layoutParams.height;
        int x = layoutParams.x + (int) tranX;
        if (x < 0) x = 0;
        else if (x > maxX) x = maxX;
        int y = layoutParams.y + (int) tranY;
        if (y < 0) y = 0;
        else if (y > maxY) y = maxY;

        layoutParams.x = x;
        layoutParams.y = y;
        windowManager.updateViewLayout(textView, layoutParams);
        lastX = nowX;
        lastY = nowY;
        break;
      case MotionEvent.ACTION_UP:
        boolean isTap = Math.abs(event.getRawX() - downX) < touchSlop
          && Math.abs(event.getRawY() - downY) < touchSlop
          && (SystemClock.uptimeMillis() - downTime) < TAP_MAX_DURATION;
        if (isTap) {
          if (isDocked) unDock();
          else toggleToolbar();
          break;
        }
        // 位置照常持久化（拍板：dock 位置存、半隐状态不存）
        tranY = 0;
        float percentageX = (float) layoutParams.x / (float) maxWidth * 100f;
        float percentageY = (float) layoutParams.y / (float) maxHeight * 100f;
        if (percentageX != prevViewPercentageX * 100f || percentageY != prevViewPercentageY * 100f) {
          prevViewPercentageX = percentageX / 100f;
          prevViewPercentageY = percentageY / 100f;
          sendPositionEvent(percentageX, percentageY);
        }
        if (!isDocked && !isLock) checkDock(event.getRawX());
        if (toolbar != null && toolbar.isShowing()) {
          // 拖动后工具条跟随重算（审查 S13）
          showToolbar();
        }
        break;
    }
    return true;
  }

  /**
   * 手指松手时贴近屏幕左右缘 → 吸附半隐（D6）。
   * 按手指而非窗口位置判定：92% 定宽下窗口 x 全程距屏缘 ≤8% 屏宽（<24dp 判定区），
   * 按窗口判定会每次松手必误触（真机反馈「松手乱飘/细条遮挡」）。
   */
  private void checkDock(float rawX) {
    if (rawX <= dockEdgeThreshold) dock(true);
    else if (rawX >= maxWidth - dockEdgeThreshold) dock(false);
  }

  private void dock(boolean left) {
    isDocked = true;
    dockedLeft = left;
    dismissToolbar();
    layoutParams.width = (int) (maxWidth * DOCKED_WIDTH_PERCENT);
    layoutParams.x = left ? 0 : maxWidth - layoutParams.width;
    if (textView == null) return;
    textView.setWidth(layoutParams.width);
    textView.setDocked(true);
    textView.setAlpha(DOCKED_ALPHA);
    setLayoutParamsHeight();
    if (isViewAttached) windowManager.updateViewLayout(textView, layoutParams);
    // 吸附落点照常持久化（拍板：位置存；审查 S5）
    float percentageX = (float) layoutParams.x / (float) maxWidth * 100f;
    prevViewPercentageX = percentageX / 100f;
    sendPositionEvent(percentageX, prevViewPercentageY * 100f);
  }

  private void unDock() {
    isDocked = false;
    layoutParams.width = (int) (maxWidth * NORMAL_WIDTH_PERCENT);
    int maxX = maxWidth - layoutParams.width;
    if (layoutParams.x > maxX) layoutParams.x = maxX;
    if (textView == null) return;
    textView.setWidth(layoutParams.width);
    textView.setDocked(false);
    textView.setAlpha(alpha);
    setLayoutParamsHeight();
    if (isViewAttached) windowManager.updateViewLayout(textView, layoutParams);
    // 仅同步内部百分比，持久化统一由 ACTION_UP 按终位发送（审查 S8）
    prevViewPercentageX = (float) layoutParams.x / (float) maxWidth;
  }

  private void toggleToolbar() {
    if (toolbar == null) return;
    if (toolbar.isShowing()) toolbar.dismiss();
    else showToolbar();
  }

  private void showToolbar() {
    if (toolbar == null) return;
    toolbar.setPlayState(currentPlayState);
    toolbar.setTextSizeState(textSize);
    toolbar.show(layoutParams.x, layoutParams.y, layoutParams.width, layoutParams.height);
  }

  /** 歌词窗几何变化后工具条跟随，防毛玻璃压住歌词导致调参效果不可见（走查反馈 2026-10-21） */
  private void repositionToolbar() {
    if (toolbar != null && toolbar.isShowing()) {
      toolbar.repositionTo(layoutParams.x, layoutParams.y, layoutParams.width, layoutParams.height);
    }
  }

  private void dismissToolbar() {
    if (toolbar != null) toolbar.dismiss();
  }

  public void lockView() {
    isLock = true;
    if (windowManager == null || textView == null) return;
    // 锁定前先恢复 normal（锁定×dock 组合态规则，审查 I7）
    if (isDocked) unDock();
    // 穿透态不得残留可点工具条（状态机，审查 I6）
    dismissToolbar();
    layoutParams.flags = getLayoutParamsFlags();

    if (Build.VERSION.SDK_INT > Build.VERSION_CODES.R) {
      layoutParams.alpha = 0.8f;
    }
    // 前台隐身（摘窗）期间仅更新参数，恢复时 resumeView 携新参数上屏
    if (isViewAttached) windowManager.updateViewLayout(textView, layoutParams);
  }

  public void unlockView() {
    isLock = false;
    if (windowManager == null || textView == null) return;
    layoutParams.flags = getLayoutParamsFlags();

    if (Build.VERSION.SDK_INT > Build.VERSION_CODES.R) {
      layoutParams.alpha = 1.0f;
    }
    if (isViewAttached) windowManager.updateViewLayout(textView, layoutParams);
  }

  public void setColor(String playedColor) {
    this.playedColor = playedColor;
    if (textView == null) return;
    textView.setTextColor(parseColor(playedColor));
  }

  public void setAlpha(float alpha) {
    this.alpha = alpha;
    if (textView == null || isDocked) return;
    textView.setAlpha(alpha);
  }

  public void setSingleLine(boolean isSingleLine) {
    this.isSingleLine = isSingleLine;
    if (textView == null || layoutParams == null) return;
    if (isViewAttached) windowManager.removeView(textView);
    isViewAttached = false;
    createTextView();
    textView.setWidth(layoutParams.width);
    setLayoutParamsHeight();
    if (!isViewPaused) {
      // 前台隐身中仅重建实例不恢复显示，恢复时 resumeView 携新视图上屏
      windowManager.addView(textView, layoutParams);
      isViewAttached = true;
    }
    setLyric(currentLyric, currentExtendedLyrics, currentNextLyric);
    repositionToolbar();
  }

  public void setShowToggleAnima(boolean showToggleAnima) {
    isShowToggleAnima = showToggleAnima;
    if (textView == null) return;
    textView.setShowAnima(showToggleAnima);
  }

  public void setTextSize(float size) {
    this.textSize = size;
    if (textView == null || layoutParams == null) return;
    textView.setTextSize(size);
    setLayoutParamsHeight();
    if (isViewAttached) windowManager.updateViewLayout(textView, layoutParams);
    if (toolbar != null && toolbar.isShowing()) {
      toolbar.setTextSizeState(size);
      repositionToolbar();
    }
  }

  /** 前台隐身（D7）：仅摘除窗口保留实例，歌词播放器状态不动；与 hideDesktopLyric 的销毁不同 */
  public void pauseView() {
    if (!isViewAttached) return;
    dismissToolbar();
    try {
      windowManager.removeView(textView);
    } catch (Exception ignored) {
      // 窗口已不在（重复 pause 等），保持状态一致
    }
    isViewAttached = false;
    isViewPaused = true;
  }

  public void resumeView() {
    if (isViewAttached || textView == null || layoutParams == null) return;
    // 暂隐期间可能发生旋转：恢复前按当前屏幕重算宽度/位置/高度
    updateWH();
    fixViewPosition();
    try {
      windowManager.addView(textView, layoutParams);
    } catch (Exception ignored) {
      return;
    }
    isViewAttached = true;
    isViewPaused = false;
  }

  public void setToolbarPlayState(boolean play) {
    currentPlayState = play;
    if (toolbar != null) toolbar.setPlayState(play);
  }

  public void setThemePalette(int[] palette) {
    if (toolbar != null) toolbar.setPalette(palette);
  }

  public void destroyView() {
    if (textView == null || windowManager == null) return;
    dismissToolbar();
    if (isViewAttached) {
      try {
        windowManager.removeView(textView);
      } catch (Exception ignored) {
      }
    }
    textView = null;
    isViewAttached = false;
    isViewPaused = false;
    removeOrientationEvent();
  }

  public void destroy() {
    destroyView();
    toolbar = null;
    windowManager = null;
    layoutParams = null;
  }
}

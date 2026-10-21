package cn.toside.music.mobile.lyric;

import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

import cn.toside.music.mobile.R;

// 悬浮歌词工具条（独立 WindowManager 窗口，弃选内嵌方案：内嵌需扩大歌词窗 bounds、复杂化 touch 分发）。
// 按钮动作单源走 JS 事件（跳回 App 除外，原生直发）；播放/暂停图标态与字号边界由 JS 同步回写。
public class LyricToolbar {
  private static final long AUTO_HIDE_DELAY = 3000L;
  // sp 口径（与 LyricView.textSize 同源；JS 存储值 100-500 过桥 ÷10）
  private static final float TEXT_SIZE_MIN = 10f;
  private static final float TEXT_SIZE_MAX = 50f;

  private final WindowManager windowManager;
  private final ReactApplicationContext reactContext;
  private final LyricEvent lyricEvent;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable autoHideRunnable = this::dismiss;

  private LinearLayout layout = null;
  private WindowManager.LayoutParams layoutParams = null;
  private ImageButton playButton = null;
  private TextView fontSizeDownButton = null;
  private TextView fontSizeUpButton = null;
  private boolean isPlay = false;
  private float currentTextSize = 18f;

  LyricToolbar(ReactApplicationContext reactContext, LyricEvent lyricEvent) {
    this.reactContext = reactContext;
    this.lyricEvent = lyricEvent;
    this.windowManager = (WindowManager) reactContext.getSystemService(Context.WINDOW_SERVICE);
  }

  public boolean isShowing() {
    return layout != null;
  }

  /** 歌词窗上方呼出（越界翻转到下方）；lyricRect 依次为 x/y/width/height */
  public void show(int lyricX, int lyricY, int lyricWidth, int lyricHeight) {
    dismiss();
    layout = buildLayout();

    layoutParams = new WindowManager.LayoutParams();
    layoutParams.type = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
      ? WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
      : WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
    layoutParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
      | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
      | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
    layoutParams.format = PixelFormat.TRANSPARENT;
    layoutParams.gravity = Gravity.TOP | Gravity.START;
    layoutParams.width = WindowManager.LayoutParams.WRAP_CONTENT;
    layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT;
    // 初值按预估工具条高度放歌词窗上方，attach 后实测尺寸精确定位（防首帧跳变，审查 S3）
    layoutParams.x = lyricX + lyricWidth / 2;
    layoutParams.y = lyricY - dp(56);

    windowManager.addView(layout, layoutParams);
    applyTextSizeState();
    layout.post(() -> updatePosition(lyricX, lyricY, lyricWidth, lyricHeight));
    scheduleAutoHide();
  }

  public void dismiss() {
    handler.removeCallbacks(autoHideRunnable);
    if (layout == null) return;
    try {
      windowManager.removeView(layout);
    } catch (Exception ignored) {
      // 窗口已被移除（歌词窗销毁联动等），无需处理
    }
    layout = null;
    layoutParams = null;
    playButton = null;
    fontSizeDownButton = null;
    fontSizeUpButton = null;
  }

  public void setPlayState(boolean play) {
    isPlay = play;
    if (playButton != null) {
      playButton.setImageResource(play ? R.drawable.ic_lyric_tb_pause : R.drawable.ic_lyric_tb_play);
    }
  }

  /** JS 步进后回写当前字号，驱动 A± 到界置灰 */
  public void setTextSizeState(float textSize) {
    currentTextSize = textSize;
    applyTextSizeState();
  }

  private void applyTextSizeState() {
    if (layout == null) return;
    if (fontSizeDownButton != null) {
      fontSizeDownButton.setEnabled(currentTextSize > TEXT_SIZE_MIN);
      fontSizeDownButton.setAlpha(currentTextSize > TEXT_SIZE_MIN ? 1f : 0.35f);
    }
    if (fontSizeUpButton != null) {
      fontSizeUpButton.setEnabled(currentTextSize < TEXT_SIZE_MAX);
      fontSizeUpButton.setAlpha(currentTextSize < TEXT_SIZE_MAX ? 1f : 0.35f);
    }
  }

  private void updatePosition(int lyricX, int lyricY, int lyricWidth, int lyricHeight) {
    if (layout == null || layoutParams == null) return;
    int margin = dp(12);
    int width = layout.getMeasuredWidth();
    int height = layout.getMeasuredHeight();
    DisplayMetrics metrics = new DisplayMetrics();
    windowManager.getDefaultDisplay().getMetrics(metrics);
    int x = lyricX + (lyricWidth - width) / 2;
    if (x < 0) x = 0;
    else if (x > metrics.widthPixels - width) x = metrics.widthPixels - width;
    int y = lyricY - height - margin;
    if (y < 0) y = lyricY + lyricHeight + margin;
    layoutParams.x = x;
    layoutParams.y = y;
    windowManager.updateViewLayout(layout, layoutParams);
  }

  private LinearLayout buildLayout() {
    LinearLayout box = new LinearLayout(reactContext);
    box.setOrientation(LinearLayout.HORIZONTAL);
    box.setBackgroundResource(R.drawable.lyric_toolbar_bg);
    int padding = dp(6);
    box.setPadding(padding, padding, padding, padding);

    box.addView(iconButton(R.drawable.ic_lyric_tb_skip_previous, "skipPrev"));
    playButton = iconButton(isPlay ? R.drawable.ic_lyric_tb_pause : R.drawable.ic_lyric_tb_play, "togglePlay");
    box.addView(playButton);
    box.addView(iconButton(R.drawable.ic_lyric_tb_skip_next, "skipNext"));
    // 跳回App原生直发，不走 JS 事件
    box.addView(iconButton(R.drawable.ic_lyric_tb_app, null));
    fontSizeDownButton = textButton("A-", "fontSizeDown");
    box.addView(fontSizeDownButton);
    fontSizeUpButton = textButton("A+", "fontSizeUp");
    box.addView(fontSizeUpButton);
    box.addView(iconButton(R.drawable.ic_lyric_tb_lock, "lock"));
    box.addView(iconButton(R.drawable.ic_lyric_tb_close, "close"));
    return box;
  }

  private ImageButton iconButton(int resId, String action) {
    ImageButton button = new ImageButton(reactContext);
    button.setImageResource(resId);
    button.setBackgroundResource(R.drawable.lyric_toolbar_btn_bg);
    int size = dp(40);
    button.setLayoutParams(new LinearLayout.LayoutParams(size, size));
    int padding = dp(9);
    button.setPadding(padding, padding, padding, padding);
    if (action != null) button.setOnClickListener(v -> handleAction(action));
    else button.setOnClickListener(v -> launchApp());
    return button;
  }

  private TextView textButton(String label, String action) {
    TextView button = new TextView(reactContext);
    button.setText(label);
    button.setTextColor(0xFFFFFFFF);
    button.setTextSize(15);
    button.setGravity(Gravity.CENTER);
    button.setBackgroundResource(R.drawable.lyric_toolbar_btn_bg);
    int size = dp(40);
    button.setLayoutParams(new LinearLayout.LayoutParams(dp(44), size));
    button.setOnClickListener(v -> handleAction(action));
    return button;
  }

  private void handleAction(String action) {
    scheduleAutoHide();
    // 锁定/关闭原生侧即时收起（状态机约束：穿透态/销毁前不得残留可点工具条），JS 随后落地状态
    if ("lock".equals(action) || "close".equals(action)) dismiss();
    WritableMap params = Arguments.createMap();
    params.putString("action", action);
    lyricEvent.sendEvent(LyricEvent.LYRIC_TOOLBAR_ACTION, params);
  }

  private void launchApp() {
    scheduleAutoHide();
    Intent intent = reactContext.getPackageManager().getLaunchIntentForPackage(reactContext.getPackageName());
    if (intent == null) return;
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      reactContext.startActivity(intent);
    } catch (Exception ignored) {
      // 启动失败（应用被强杀中等）静默忽略
    }
  }

  private void scheduleAutoHide() {
    handler.removeCallbacks(autoHideRunnable);
    handler.postDelayed(autoHideRunnable, AUTO_HIDE_DELAY);
  }

  private int dp(int value) {
    return (int) (value * reactContext.getResources().getDisplayMetrics().density + 0.5f);
  }

}

package cn.toside.music.mobile.lyric;

import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

import cn.toside.music.mobile.R;

// 悬浮歌词工具条（独立 WindowManager 窗口，弃选内嵌方案：内嵌需扩大歌词窗 bounds、复杂化 touch 分发）。
// AM 风格精致化（真机拍板 2026-10-21）：毛玻璃胶囊（API 31+ cross-window blur，低版本退化纯色半透明）、
// 图标无底纹、间距收紧、色板圆点化；锁定钮移除（锁定入口回 App，锁定态业界共识=完全隐形）。
// 双行结构：控制行（播放/上下曲/跳回App/字号/调色/关闭）+ 调色行（点调色钮展开，色板由 JS 单源下发）。
// 按钮动作单源走 JS 事件（跳回 App 除外，原生直发）。
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
  private LinearLayout paletteRow = null;
  private WindowManager.LayoutParams layoutParams = null;
  private ImageButton playButton = null;
  private TextView fontSizeDownButton = null;
  private TextView fontSizeUpButton = null;
  private boolean isPlay = false;
  private float currentTextSize = 18f;
  private int[] palette = new int[0];
  // 上次呼出时的歌词窗矩形，展开/收起色板行后重定位用
  private int lastLyricX = 0;
  private int lastLyricY = 0;
  private int lastLyricWidth = 0;
  private int lastLyricHeight = 0;

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
    lastLyricX = lyricX;
    lastLyricY = lyricY;
    lastLyricWidth = lyricWidth;
    lastLyricHeight = lyricHeight;
    layout = buildLayout();

    layoutParams = new WindowManager.LayoutParams();
    layoutParams.type = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
      ? WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
      : WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
    layoutParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
      | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
      | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
    layoutParams.format = PixelFormat.TRANSPARENT;
    // AM 毛玻璃：API 31+ 背后实时模糊（系统未开「允许模糊」时自动退化为纯色半透明底）
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      layoutParams.flags |= WindowManager.LayoutParams.FLAG_BLUR_BEHIND;
      layoutParams.setBlurBehindRadius(dp(20));
    }
    layoutParams.gravity = Gravity.TOP | Gravity.START;
    layoutParams.width = WindowManager.LayoutParams.WRAP_CONTENT;
    layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT;
    // 初值按预估工具条高度放歌词窗上方，attach 后实测尺寸精确定位（防首帧跳变，审查 S3）
    layoutParams.x = lyricX + lyricWidth / 2;
    layoutParams.y = lyricY - dp(52);

    windowManager.addView(layout, layoutParams);
    applyTextSizeState();
    layout.post(this::updatePosition);
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
    paletteRow = null;
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

  /** JS 下发色板（单源在 JS 色板表，原生色块点击回传索引），已展开时重建色块 */
  public void setPalette(int[] colors) {
    palette = colors;
    rebuildPaletteChips();
  }

  private void updatePosition() {
    if (layout == null || layoutParams == null) return;
    int margin = dp(12);
    int width = layout.getMeasuredWidth();
    int height = layout.getMeasuredHeight();
    DisplayMetrics metrics = new DisplayMetrics();
    windowManager.getDefaultDisplay().getMetrics(metrics);
    int x = lastLyricX + (lastLyricWidth - width) / 2;
    if (x < 0) x = 0;
    else if (x > metrics.widthPixels - width) x = metrics.widthPixels - width;
    int y = lastLyricY - height - margin;
    if (y < 0) y = lastLyricY + lastLyricHeight + margin;
    layoutParams.x = x;
    layoutParams.y = y;
    windowManager.updateViewLayout(layout, layoutParams);
  }

  private LinearLayout buildLayout() {
    int padding = dp(5);

    LinearLayout controlsRow = new LinearLayout(reactContext);
    controlsRow.setOrientation(LinearLayout.HORIZONTAL);
    controlsRow.setGravity(Gravity.CENTER_VERTICAL);
    controlsRow.addView(iconButton(R.drawable.ic_lyric_tb_skip_previous, "skipPrev"));
    playButton = iconButton(isPlay ? R.drawable.ic_lyric_tb_pause : R.drawable.ic_lyric_tb_play, "togglePlay");
    controlsRow.addView(playButton);
    controlsRow.addView(iconButton(R.drawable.ic_lyric_tb_skip_next, "skipNext"));
    // 跳回App原生直发，不走 JS 事件
    controlsRow.addView(iconButton(R.drawable.ic_lyric_tb_app, null));
    fontSizeDownButton = textButton("A-", "fontSizeDown");
    controlsRow.addView(fontSizeDownButton);
    fontSizeUpButton = textButton("A+", "fontSizeUp");
    controlsRow.addView(fontSizeUpButton);
    paletteButtonHook(controlsRow);
    controlsRow.addView(iconButton(R.drawable.ic_lyric_tb_close, "close"));

    paletteRow = new LinearLayout(reactContext);
    paletteRow.setOrientation(LinearLayout.HORIZONTAL);
    paletteRow.setGravity(Gravity.CENTER_VERTICAL);
    paletteRow.setVisibility(View.GONE);
    LinearLayout.LayoutParams paletteParams = new LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    paletteParams.topMargin = dp(4);
    paletteRow.setLayoutParams(paletteParams);
    rebuildPaletteChips();

    // 双行根布局：控制行 + 调色行（点调色钮展开）
    LinearLayout root = new LinearLayout(reactContext);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundResource(R.drawable.lyric_toolbar_bg);
    root.setPadding(padding, padding, padding, padding);
    root.addView(controlsRow);
    root.addView(paletteRow);
    return root;
  }

  private void paletteButtonHook(LinearLayout controlsRow) {
    ImageButton button = iconButton(R.drawable.ic_lyric_tb_palette, "palette");
    controlsRow.addView(button);
  }

  private void rebuildPaletteChips() {
    if (paletteRow == null) return;
    paletteRow.removeAllViews();
    int chipSize = dp(14);
    int chipMargin = dp(5);
    for (int i = 0; i < palette.length; i++) {
      final int index = i;
      View chip = new View(reactContext);
      GradientDrawable background = new GradientDrawable();
      background.setColor(palette[i]);
      background.setShape(GradientDrawable.OVAL);
      chip.setBackground(background);
      LinearLayout.LayoutParams chipParams = new LinearLayout.LayoutParams(chipSize, chipSize);
      chipParams.rightMargin = chipMargin;
      chip.setLayoutParams(chipParams);
      chip.setOnClickListener(v -> selectTheme(index));
      paletteRow.addView(chip);
    }
  }

  private void selectTheme(int index) {
    scheduleAutoHide();
    if (paletteRow != null) {
      paletteRow.setVisibility(View.GONE);
      if (layout != null) layout.post(this::updatePosition);
    }
    WritableMap params = Arguments.createMap();
    params.putString("action", "themeColor");
    params.putInt("index", index);
    lyricEvent.sendEvent(LyricEvent.LYRIC_TOOLBAR_ACTION, params);
  }

  private void togglePalette() {
    scheduleAutoHide();
    if (paletteRow == null) return;
    boolean show = paletteRow.getVisibility() != View.VISIBLE;
    paletteRow.setVisibility(show ? View.VISIBLE : View.GONE);
    if (layout != null) layout.post(this::updatePosition);
  }

  /** AM 风格：图标无底纹（极简），保留点击即响应 */
  private ImageButton iconButton(int resId, String action) {
    ImageButton button = new ImageButton(reactContext);
    button.setImageResource(resId);
    button.setBackgroundColor(android.graphics.Color.TRANSPARENT);
    int size = dp(36);
    button.setLayoutParams(new LinearLayout.LayoutParams(size, size));
    int padding = dp(7);
    button.setPadding(padding, padding, padding, padding);
    if (action != null) button.setOnClickListener(v -> handleAction(action));
    else button.setOnClickListener(v -> launchApp());
    return button;
  }

  private TextView textButton(String label, String action) {
    TextView button = new TextView(reactContext);
    button.setText(label);
    button.setTextColor(0xFFFFFFFF);
    button.setTextSize(14);
    button.setGravity(Gravity.CENTER);
    int size = dp(36);
    button.setLayoutParams(new LinearLayout.LayoutParams(dp(34), size));
    button.setOnClickListener(v -> handleAction(action));
    return button;
  }

  private void handleAction(String action) {
    scheduleAutoHide();
    // 关闭原生侧即时收起（状态机约束：销毁前不得残留可点工具条），JS 随后落地状态
    if ("close".equals(action)) dismiss();
    // 调色钮原生展开/收起色板行，不发 JS 事件
    if ("palette".equals(action)) {
      togglePalette();
      return;
    }
    WritableMap params = Arguments.createMap();
    params.putString("action", action);
    lyricEvent.sendEvent(LyricEvent.LYRIC_TOOLBAR_ACTION, params);
  }

  private void launchApp() {
    scheduleAutoHide();
    Context context = reactContext;
    Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (intent == null) return;
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      context.startActivity(intent);
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

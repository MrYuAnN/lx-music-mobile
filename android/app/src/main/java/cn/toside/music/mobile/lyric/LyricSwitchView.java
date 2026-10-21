package cn.toside.music.mobile.lyric;

import android.annotation.SuppressLint;
import android.content.Context;
import android.text.TextPaint;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.AnimationSet;
import android.view.animation.TranslateAnimation;
import android.widget.LinearLayout;
import android.widget.TextSwitcher;
import android.widget.TextView;

import androidx.annotation.Nullable;

import java.util.ArrayList;

// 三行悬浮歌词容器（无底板重设计）：行1 当前行（TextSwitcher 轮换+跑马灯）、行2 翻译（×0.72）、
// 行3 下一句（×0.85，未播色）。单行模式仅行1；docked 细条态仅行1 且停跑马灯。
// 文字对齐固定水平居中（对齐设置已砍，D8）。
@SuppressLint({"ViewConstructor"})
public final class LyricSwitchView extends LinearLayout {
  private static final float TRANSLATION_SIZE_RATIO = 0.72f;
  private static final float NEXT_SIZE_RATIO = 0.85f;
  private static final float ROW_SPACING_RATIO = 0.18f;

  private final TextSwitcher mainSwitcher;
  private final ArrayList<LyricTextView> mainViews;
  private final LyricStrokeTextView translationView;
  private final LyricStrokeTextView nextView;
  private final boolean isSingleLine;
  private boolean isShowAnima;
  private boolean isDocked = false;

  private String lastMainText = "";
  private ArrayList<String> lastExtendedLyrics = new ArrayList<>();
  private String lastNextText = "";

  private int mainRowHeight = 0;
  private int translationRowHeight = 0;
  private int nextRowHeight = 0;
  private int rowSpacing = 0;

  public LyricSwitchView(Context context, boolean isSingleLine, boolean isShowAnima) {
    super(context);
    this.isSingleLine = isSingleLine;
    this.isShowAnima = isShowAnima;
    setOrientation(VERTICAL);

    mainSwitcher = new TextSwitcher(context);
    mainViews = new ArrayList<>(2);
    final int gravity = Gravity.CENTER_HORIZONTAL | Gravity.TOP;
    // TextSwitcher 契约要求先 setFactory 再 setText（零子 view 时 makeView 两次生成双缓冲）
    mainSwitcher.setFactory(() -> {
      LyricTextView view = new LyricTextView(context);
      view.setGravity(gravity);
      mainViews.add(view);
      return view;
    });
    setMainAnima();

    translationView = new LyricStrokeTextView(context);
    nextView = new LyricStrokeTextView(context);

    translationView.setGravity(gravity);
    nextView.setGravity(gravity);

    translationView.setVisibility(GONE);
    nextView.setVisibility(GONE);

    addView(mainSwitcher, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
    addView(translationView, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
    addView(nextView, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
  }

  @Nullable
  public Animation inAnim(float height) {
    if (!isShowAnima) return null;
    AnimationSet animationSet = new AnimationSet(true);
    TranslateAnimation translateAnimation = new TranslateAnimation(0.0F, 0.0F, height, 0.0F);
    translateAnimation.setDuration(300L);
    AlphaAnimation alphaAnimation = new AlphaAnimation(0.0F, 1.0F);
    alphaAnimation.setDuration(300L);
    animationSet.addAnimation(translateAnimation);
    animationSet.addAnimation(alphaAnimation);
    return animationSet;
  }

  @Nullable
  public Animation outAnim(float height) {
    if (!isShowAnima) return null;
    AnimationSet animationSet = new AnimationSet(true);
    TranslateAnimation translateAnimation = new TranslateAnimation(0.0F, 0.0F, 0.0F, -height);
    translateAnimation.setDuration(300L);
    AlphaAnimation alphaAnimation = new AlphaAnimation(1.0F, 0.0F);
    alphaAnimation.setDuration(300L);
    animationSet.addAnimation(translateAnimation);
    animationSet.addAnimation(alphaAnimation);
    return animationSet;
  }

  private void setMainAnima() {
    float size = mainViews.get(0).getTextSize();
    mainSwitcher.setInAnimation(inAnim(size));
    mainSwitcher.setOutAnimation(outAnim(size));
  }

  public void setShowAnima(boolean showAnima) {
    isShowAnima = showAnima;
    setMainAnima();
  }

  public TextPaint getPaint() {
    TextView currentView = (TextView) mainSwitcher.getCurrentView();
    if (currentView == null) return null;
    return currentView.getPaint();
  }

  public void setLyric(String mainText, ArrayList<String> extendedLyrics, String nextText) {
    lastMainText = mainText;
    lastExtendedLyrics = extendedLyrics;
    lastNextText = nextText;
    mainSwitcher.setText(mainText);
    applySecondaryRows();
  }

  private void applySecondaryRows() {
    boolean secondaryAllowed = !isSingleLine && !isDocked;
    boolean showTranslation = secondaryAllowed && lastExtendedLyrics.size() > 0 && lastExtendedLyrics.get(0).length() > 0;
    translationView.setVisibility(showTranslation ? VISIBLE : GONE);
    translationView.setText(showTranslation ? lastExtendedLyrics.get(0) : "");
    boolean showNext = secondaryAllowed && lastNextText != null && lastNextText.length() > 0;
    nextView.setVisibility(showNext ? VISIBLE : GONE);
    nextView.setText(showNext ? lastNextText : "");
    requestLayout();
  }

  public void setTextColor(int color) {
    for (LyricTextView v : mainViews) v.setTextColor(color);
    translationView.setTextColor(color);
  }

  /** 主行视宽同步（跑马灯按 viewWidth 判定），容器内其余行为 MATCH_PARENT 自取实际宽 */
  public void setWidth(int width) {
    for (LyricTextView v : mainViews) v.setWidth(width);
  }

  public void setUnplayColor(int color) {
    nextView.setTextColor(color);
  }

  public void setShadowColor(int color) {
    for (LyricTextView v : mainViews) v.setShadowLayer(1.6f, 1.5f, 1.3f, color);
    translationView.setShadowLayer(1.6f, 1.5f, 1.3f, color);
    nextView.setShadowLayer(1.6f, 1.5f, 1.3f, color);
  }

  public void setTextSize(float size) {
    for (LyricTextView v : mainViews) v.setTextSize(size);
    translationView.setTextSize(size * TRANSLATION_SIZE_RATIO);
    nextView.setTextSize(size * NEXT_SIZE_RATIO);
    updateRowHeights();
    setMainAnima();
  }

  private void updateRowHeights() {
    mainRowHeight = mainViews.get(0).getPaint().getFontMetricsInt(null);
    translationRowHeight = translationView.getPaint().getFontMetricsInt(null);
    nextRowHeight = nextView.getPaint().getFontMetricsInt(null);
    rowSpacing = (int) (mainViews.get(0).getTextSize() * ROW_SPACING_RATIO);
    for (LyricTextView v : mainViews) v.setHeight(mainRowHeight);
    translationView.setHeight(translationRowHeight);
    nextView.setHeight(nextRowHeight);
    ViewGroup.LayoutParams switcherParams = mainSwitcher.getLayoutParams();
    switcherParams.height = mainRowHeight;
    mainSwitcher.setLayoutParams(switcherParams);
  }

  /** 各可见行高之和（高度计算以行2/3 单行为前提，见方案 §4.1.6） */
  public int getTotalHeight() {
    int height = mainRowHeight;
    if (translationView.getVisibility() == VISIBLE) height += rowSpacing + translationRowHeight;
    if (nextView.getVisibility() == VISIBLE) height += rowSpacing + nextRowHeight;
    return height;
  }

  public void setDocked(boolean docked) {
    isDocked = docked;
    for (LyricTextView v : mainViews) v.setMarqueeEnabled(!docked);
    applySecondaryRows();
  }

}

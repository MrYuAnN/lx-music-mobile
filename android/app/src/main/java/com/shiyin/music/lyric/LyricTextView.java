package com.shiyin.music.lyric;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.Gravity;
import android.widget.TextView;

// 主行歌词控件：参照 AM 歌词视觉语言的双层柔和阴影绘制（远层柔晕 + 近层贴影，无描边——真机反馈
// 描边显脏，2026-10-21 拍板去描边；阴影系数无业界对标，本产品自定）+ 可开关的跑马灯滚动。
// 跑马灯关闭（docked 细条态）时静态绘制。
// https://github.com/Block-Network/StatusBarLyric/blob/main/app/src/main/java/statusbar/lyric/view/LyricTextView.kt
@SuppressLint("AppCompatCustomView")
public class LyricTextView extends TextView {
  private boolean isStop = true;
  private float textLength = 0F;
  private float viewWidth = 0F;
  private float viewHeight = 0F;
  private final float SPEED_LIMIT = 0.135F;
  private float speed;
  private float xx = 0F;
  private int gravityVertical = Gravity.TOP;
  private int gravityHorizontal = Gravity.CENTER;
  private float y = 0F;
  // volatile：悬浮窗视图创建于 RN modules 线程，屏灭恢复等路径在主线程回写 text，防跨线程可见性竞态
  private volatile String text = null;
  private final Paint mPaint;
  private final Paint mAmbientShadowPaint;
  private boolean marqueeEnabled = true;
  private final Runnable mStartScrollRunnable;
  private final Runnable invalidateRunnable;
  public static final int startScrollDelay = 1500;
  public static final int invalidateDelay = 10;

  public LyricTextView(Context context) {
    super(context);
    mStartScrollRunnable = LyricTextView.this::startScroll;
    invalidateRunnable = LyricTextView.this::invalidate;
    mPaint = getPaint();
    // 近层贴影
    mPaint.setShadowLayer(0.06F * getTextSize(), 0F, 0.02F * getTextSize(), 0x59000000);
    // 远层柔晕（AM 式低透明大半径）
    mAmbientShadowPaint = new Paint(mPaint);
    mAmbientShadowPaint.setColor(0xFFFFFFFF);
    mAmbientShadowPaint.setShadowLayer(0.22F * getTextSize(), 0F, 0.06F * getTextSize(), 0x40000000);
    speed = SPEED_LIMIT * getTextSize();
  }

  private void init() {
    xx = 0.0F;
    textLength = getTextLength();
  }

  @Override
  protected void onDetachedFromWindow() {
    removeCallbacks(mStartScrollRunnable);
    super.onDetachedFromWindow();
  }

  @Override
  protected void onTextChanged(CharSequence text, int start, int lengthBefore, int lengthAfter) {
    super.onTextChanged(text, start, lengthBefore, lengthAfter);
    stopScroll();
    this.text = text.toString();
    init();
    postInvalidate();
    if (marqueeEnabled) postDelayed(mStartScrollRunnable, startScrollDelay);
  }

  @Override
  public void setTextColor(int color) {
    if (mPaint != null) mPaint.setColor(color);
    // 柔晕层同色联动：深色字时白柔晕会泛白边（返修审查 S6）
    if (mAmbientShadowPaint != null) mAmbientShadowPaint.setColor(color);
    postInvalidate();
  }

  @Override
  public void setTextSize(float size) {
    super.setTextSize(size);
    float px = getPaint().getTextSize();
    mAmbientShadowPaint.setTextSize(px);
    mAmbientShadowPaint.setShadowLayer(0.22F * px, 0F, 0.06F * px, 0x40000000);
    mPaint.setShadowLayer(0.06F * px, 0F, 0.02F * px, 0x59000000);
    speed = SPEED_LIMIT * px;
    if (text == null) return;
    post(mStartScrollRunnable);
  }

  @Override
  public void setWidth(int pixels) {
    super.setWidth(pixels);
    viewWidth = pixels;
    if (text == null) return;
    post(mStartScrollRunnable);
  }

  @Override
  public void setHeight(int pixels) {
    super.setHeight(pixels);
    viewHeight = pixels;
    y = getDrawY();
    if (text == null) return;
    post(mStartScrollRunnable);
  }

  @Override
  public void setGravity(int gravity) {
    if ((gravity & Gravity.RELATIVE_HORIZONTAL_GRAVITY_MASK) == 0) {
      gravity |= Gravity.START;
    }
    if ((gravity & Gravity.VERTICAL_GRAVITY_MASK) == 0) {
      gravity |= Gravity.TOP;
    }

    gravityVertical = gravity & Gravity.VERTICAL_GRAVITY_MASK;
    gravityHorizontal = gravity & Gravity.RELATIVE_HORIZONTAL_GRAVITY_MASK;

    y = getDrawY();

    if (text == null) return;
    post(mStartScrollRunnable);
  }

  public void setMarqueeEnabled(boolean enabled) {
    marqueeEnabled = enabled;
    if (!enabled) {
      stopScroll();
    } else if (text != null) {
      postDelayed(mStartScrollRunnable, startScrollDelay);
    }
  }

  @Override
  protected void onDraw(Canvas canvas) {
    if (getHeight() > 0) viewHeight = getHeight();
    // volatile 字段取局部快照，防绘制中途跨线程写入（返修审查 S5）
    String currentText = text;
    float mSpeed = speed;
    if (currentText != null) {
      float x = getDrawX();
      // 远层柔晕 + 近层正文（正文自带贴影），无描边
      canvas.drawText(currentText, x, y, mAmbientShadowPaint);
      canvas.drawText(currentText, x, y, mPaint);
      if (currentText.length() >= 20) {
        mSpeed += mSpeed;
      }
    }

    if (!isStop && marqueeEnabled) {
      if (viewWidth - xx + mSpeed >= textLength) {
        xx = viewWidth - textLength - 2;
        stopScroll();
      } else {
        xx -= mSpeed;
      }

      invalidateAfter();
    }

  }

  private void invalidateAfter() {
    removeCallbacks(invalidateRunnable);
    postDelayed(invalidateRunnable, invalidateDelay);
  }

  private void startScroll() {
    init();
    isStop = false;
    postInvalidate();
  }

  private void stopScroll() {
    isStop = true;
    removeCallbacks(mStartScrollRunnable);
    postInvalidate();
  }

  private float getTextLength() {
    // 判空为本文件跑马灯崩溃（measureText(null)，真机 2026-10-21）的实际生效修复点
    return mPaint == null || text == null ? 0.0F : mPaint.measureText(text);
  }

  private float getDrawY() {
    Paint.FontMetrics fontMetrics = mPaint.getFontMetrics();
    float top = fontMetrics.top;
    float bottom = fontMetrics.bottom;
    float ascent = fontMetrics.ascent;

    float y;
    switch (gravityVertical) {
      case Gravity.CENTER_VERTICAL:
        y = viewHeight / 2F + (bottom - top) / 2 - bottom;
        break;
      case Gravity.BOTTOM:
        y = viewHeight - bottom;
        break;
      default:
        y = -ascent;
        break;
    }
    return y;
  }

  private float getDrawX() {
    float x;
    if (textLength < viewWidth) {
      switch (gravityHorizontal) {
        case Gravity.CENTER_HORIZONTAL:
          x = (viewWidth - textLength) / 2;
          break;
        case Gravity.END:
          x = viewWidth - textLength;
          break;
        default:
          x = 0;
          break;
      }
      isStop = true;
    } else {
      x = xx;
    }
    return x;
  }

}

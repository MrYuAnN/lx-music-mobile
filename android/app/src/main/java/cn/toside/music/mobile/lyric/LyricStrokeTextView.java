package cn.toside.music.mobile.lyric;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.Gravity;
import android.widget.TextView;

// 副行歌词控件（翻译行/下一句行）：与主行同款双层描边绘制，单行手动省略号截断，无跑马灯。
@SuppressLint("AppCompatCustomView")
public class LyricStrokeTextView extends TextView {
  private final Paint mPaint;
  private final Paint mStrokePaint;
  private int gravityVertical = Gravity.TOP;
  private int gravityHorizontal = Gravity.CENTER_HORIZONTAL;
  private float y = 0F;

  public LyricStrokeTextView(Context context) {
    super(context);
    mPaint = getPaint();
    mStrokePaint = new Paint(mPaint);
    mStrokePaint.setStyle(Paint.Style.STROKE);
    mStrokePaint.setColor(Color.BLACK);
    mStrokePaint.setShadowLayer(0F, 0F, 0F, Color.TRANSPARENT);
    y = getDrawY();
  }

  private void updateStrokeWidth() {
    mStrokePaint.setStrokeWidth(Math.max(1F, getTextSize() * 0.08F));
  }

  @Override
  public void setTextColor(int color) {
    if (mPaint != null) mPaint.setColor(color);
    postInvalidate();
  }

  @Override
  public void setShadowLayer(float radius, float dx, float dy, int shadowColor) {
    if (mPaint != null) mPaint.setShadowLayer(radius, dx, dy, shadowColor);
    postInvalidate();
  }

  @Override
  public void setTextSize(float size) {
    super.setTextSize(size);
    mStrokePaint.setTextSize(getPaint().getTextSize());
    updateStrokeWidth();
    y = getDrawY();
    postInvalidate();
  }

  @Override
  public void setGravity(int gravity) {
    gravityVertical = gravity & Gravity.VERTICAL_GRAVITY_MASK;
    gravityHorizontal = gravity & Gravity.RELATIVE_HORIZONTAL_GRAVITY_MASK;
    y = getDrawY();
    postInvalidate();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    CharSequence source = getText();
    if (source == null || source.length() == 0) return;
    String text = source.toString();
    float viewWidth = getWidth();
    float textLength = mPaint.measureText(text);
    if (viewWidth > 0 && textLength > viewWidth) {
      text = ellipsize(text, viewWidth);
      textLength = mPaint.measureText(text);
    }
    float x;
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
    canvas.drawText(text, x, y, mStrokePaint);
    canvas.drawText(text, x, y, mPaint);
  }

  private String ellipsize(String text, float viewWidth) {
    String ellipsis = "…";
    float ellipsisLength = mPaint.measureText(ellipsis);
    int end = text.length();
    while (end > 0 && mPaint.measureText(text, 0, end) + ellipsisLength > viewWidth) end--;
    return text.substring(0, end) + ellipsis;
  }

  private float getDrawY() {
    Paint.FontMetrics fontMetrics = mPaint.getFontMetrics();
    float viewHeight = getHeight();
    switch (gravityVertical) {
      case Gravity.CENTER_VERTICAL:
        return viewHeight / 2F + (fontMetrics.bottom - fontMetrics.top) / 2 - fontMetrics.bottom;
      case Gravity.BOTTOM:
        return viewHeight - fontMetrics.bottom;
      default:
        return -fontMetrics.ascent;
    }
  }

}

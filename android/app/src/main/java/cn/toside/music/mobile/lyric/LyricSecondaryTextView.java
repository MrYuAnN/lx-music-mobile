package cn.toside.music.mobile.lyric;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.view.Gravity;
import android.widget.TextView;

// 副行歌词控件（翻译行/下一句行）：参照 AM 歌词视觉语言的双层柔和阴影（无描边，同主行；
// 阴影系数无业界对标，本产品自定），单行手动省略号截断，无跑马灯。
@SuppressLint("AppCompatCustomView")
public class LyricSecondaryTextView extends TextView {
  private final Paint mPaint;
  private final Paint mAmbientShadowPaint;
  private int gravityVertical = Gravity.TOP;
  private int gravityHorizontal = Gravity.CENTER_HORIZONTAL;
  private float y = 0F;

  public LyricSecondaryTextView(Context context) {
    super(context);
    mPaint = getPaint();
    mPaint.setShadowLayer(0.06F * getTextSize(), 0F, 0.02F * getTextSize(), 0x59000000);
    mAmbientShadowPaint = new Paint(mPaint);
    mAmbientShadowPaint.setColor(0xFFFFFFFF);
    mAmbientShadowPaint.setShadowLayer(0.22F * getTextSize(), 0F, 0.06F * getTextSize(), 0x40000000);
    y = getDrawY();
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
    canvas.drawText(text, x, y, mAmbientShadowPaint);
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

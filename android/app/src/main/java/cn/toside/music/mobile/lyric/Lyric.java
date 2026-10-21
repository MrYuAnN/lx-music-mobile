package cn.toside.music.mobile.lyric;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;

public class Lyric extends LyricPlayer {
  LyricView lyricView = null;
  LyricEvent lyricEvent = null;
  ReactApplicationContext reactAppContext;

  boolean isRunPlayer = false;
  int lastLine = 0;
  List lines = new ArrayList();
  boolean isShowTranslation;
  // roma 不再进悬浮窗（D10，三行结构无位置；全局开关保留，内嵌歌词页照常消费），字段仅为桥兼容保留
  boolean isShowRoma;
  boolean isShowLyricView = false;
  boolean isViewPaused = false;
  boolean isSendLyricTextEvent = false;
  boolean isScreenOff = false;
  String lyricText = "";
  String translationText = "";
  String romaLyricText = "";

  Lyric(ReactApplicationContext reactContext, boolean isShowTranslation, boolean isShowRoma, float playbackRate) {
    this.reactAppContext = reactContext;
    this.isShowTranslation = isShowTranslation;
    this.isShowRoma = isShowRoma;
    this.playbackRate = playbackRate;
    registerScreenBroadcastReceiver();
    registerUnlockReceiver();
  }

  private void registerScreenBroadcastReceiver() {
    final IntentFilter theFilter = new IntentFilter();
    /** System Defined Broadcast */
    theFilter.addAction(Intent.ACTION_SCREEN_ON);
    theFilter.addAction(Intent.ACTION_SCREEN_OFF);

    BroadcastReceiver screenOnOffReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        String strAction = intent.getAction();

        switch (Objects.requireNonNull(strAction)) {
          case Intent.ACTION_SCREEN_OFF:
            Log.d("Lyric", "ACTION_SCREEN_OFF");
            handleScreenOff();
            break;
          case Intent.ACTION_SCREEN_ON:
            Log.d("Lyric", "ACTION_SCREEN_ON");
            handleScreenOn();
            break;
        }
      }
    };

    reactAppContext.registerReceiver(screenOnOffReceiver, theFilter);
  }

  /** 通知栏「解锁」动作（targetSdk 34+ 动态 receiver 必须显式 NOT_EXPORTED，审查 I5） */
  private void registerUnlockReceiver() {
    IntentFilter filter = new IntentFilter(DesktopLyricNotification.ACTION_UNLOCK_DESKTOP_LYRIC);
    BroadcastReceiver unlockReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        unlockLyric();
        if (lyricEvent != null) {
          WritableMap params = Arguments.createMap();
          params.putBoolean("isLock", false);
          lyricEvent.sendEvent(LyricEvent.LYRIC_LOCK_CHANGED, params);
        }
      }
    };
    if (Build.VERSION.SDK_INT >= 33) {
      reactAppContext.registerReceiver(unlockReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    } else {
      reactAppContext.registerReceiver(unlockReceiver, filter);
    }
  }

  private boolean isDisableAutoPause() {
    return !isRunPlayer || isSendLyricTextEvent;
  }
  private void handleScreenOff() {
    isScreenOff = true;
    if (isDisableAutoPause()) return;
    setTempPause(true);
  }

  private void handleScreenOn() {
    isScreenOff = false;
    if (isDisableAutoPause()) return;
    if (lyricView == null) lyricView = new LyricView(reactAppContext, lyricEvent);
    lyricView.runOnUiThread(() -> {
      handleGetCurrentLyric(lastLine);
      setTempPause(false);
    });
  }

  private void pausePlayer() {
    if (!isRunPlayer || isShowLyricView || isSendLyricTextEvent) return;
    isRunPlayer = false;
    this.pause();
  }

  private void setCurrentLyric(String lyric, ArrayList<String> extendedLyrics, String nextLyric) {
    if (isShowLyricView && !isScreenOff && lyricView != null) {
      lyricView.setLyric(lyric, extendedLyrics, nextLyric);
    }
    if (isSendLyricTextEvent) {
      WritableMap params = Arguments.createMap();
      params.putString("text", lyric);
      params.putArray("extendedLyrics", Arguments.makeNativeArray(extendedLyrics));
      lyricEvent.sendEvent(lyricEvent.LYRIC_Line_PLAY, params);
    }
  }
  private void handleGetCurrentLyric(int lineNum) {
    lastLine = lineNum;
    if (lineNum >= 0 && lineNum < lines.size()) {
      HashMap line = (HashMap) lines.get(lineNum);
      if (line != null) {
        // 下一句行（D2 双行结构）；末行越界防护：置空由视图层隐藏（审查 S11）
        String nextLyric = "";
        if (lineNum + 1 < lines.size()) {
          HashMap nextLine = (HashMap) lines.get(lineNum + 1);
          if (nextLine != null && nextLine.get("text") != null) {
            nextLyric = (String) nextLine.get("text");
          }
        }
        setCurrentLyric((String) line.get("text"), (ArrayList<String>) line.get("extendedLyrics"), nextLyric);
        return;
      }
    }
    setCurrentLyric("", new ArrayList<>(0), "");
  }

  public void setSendLyricTextEvent(boolean isSend) {
    if (isSendLyricTextEvent == isSend) return;
    isSendLyricTextEvent = isSend;
    if (isSend) {
      if (lyricEvent == null) lyricEvent = new LyricEvent(reactAppContext);
      isRunPlayer = true;
    } else {
      pausePlayer();
    }
  }

  public void showDesktopLyric(Bundle options, Promise promise) {
    if (isShowLyricView) return;
    if (lyricEvent == null) lyricEvent = new LyricEvent(reactAppContext);
    isShowLyricView = true;
    isViewPaused = false;
    if (lyricView == null) lyricView = new LyricView(reactAppContext, lyricEvent);
    try {
      lyricView.showLyricView(options);
    } catch (Exception e) {
      promise.reject(e);
      Log.e("Lyric", e.getMessage());
      return;
    }
    isRunPlayer = true;
    promise.resolve(null);
  }

  public void hideDesktopLyric() {
    if (!isShowLyricView) return;
    isShowLyricView = false;
    isViewPaused = false;
    // 锁定态关闭时撤常驻解锁通知，防残留（审查 I2）
    DesktopLyricNotification.cancel(reactAppContext);
    pausePlayer();
    if (lyricView != null) {
      lyricView.destroy();
      lyricView = null;
    }
  }

  /** 前台隐身（D7）：摘窗保实例，播放器推进不停，恢复即显示当前行 */
  public void pauseDesktopLyricView() {
    if (!isShowLyricView || isViewPaused) return;
    isViewPaused = true;
    if (lyricView != null) lyricView.pauseView();
  }

  public void resumeDesktopLyricView() {
    if (!isShowLyricView || !isViewPaused) return;
    isViewPaused = false;
    if (lyricView == null) return;
    lyricView.resumeView();
  }

  private void refreshLyric() {
    if (!isRunPlayer) return;
    ArrayList<String> extendedLyrics = new ArrayList<>(2);
    if (isShowTranslation && !"".equals(translationText)) extendedLyrics.add(translationText);
    super.setLyric(lyricText, extendedLyrics);
  }

  public void setLyric(String lyric, String translation, String romaLyric) {
    lyricText = lyric;
    translationText = translation;
    romaLyricText = romaLyric;
    refreshLyric();
  }

  @Override
  public void onSetLyric(List lines) {
    this.lines = lines;
    handleGetCurrentLyric(-1);
  }

  @Override
  public void onPlay(int lineNum) {
    handleGetCurrentLyric(lineNum);
  }

  public void pauseLyric() {
    pause();
    if (!isRunPlayer) return;
    handleGetCurrentLyric(-1);
  }

  public void lockLyric() {
    if (lyricView == null) return;
    lyricView.lockView();
    DesktopLyricNotification.show(reactAppContext);
  }

  public void unlockLyric() {
    DesktopLyricNotification.cancel(reactAppContext);
    if (lyricView == null) return;
    lyricView.unlockView();
  }

  public void setSingleLine(boolean singleLine) {
    if (lyricView == null) return;
    lyricView.setSingleLine(singleLine);
  }

  public void setShowToggleAnima(boolean showToggleAnima) {
    if (lyricView == null) return;
    lyricView.setShowToggleAnima(showToggleAnima);
  }

  public void toggleTranslation(boolean isShowTranslation) {
    this.isShowTranslation = isShowTranslation;
    refreshLyric();
  }

  public void toggleRoma(boolean isShowRoma) {
    this.isShowRoma = isShowRoma;
    // roma 对悬浮窗不再生效（D10），仅内嵌歌词页消费
    refreshLyric();
  }

  public void setPlayedColor(String unplayColor, String playedColor, String shadowColor) {
    if (lyricView == null) return;
    lyricView.setColor(unplayColor, playedColor, shadowColor);
  }

  public void setAlpha(float alpha) {
    if (lyricView == null) return;
    lyricView.setAlpha(alpha);
  }

  public void setTextSize(float size) {
    if (lyricView == null) return;
    lyricView.setTextSize(size);
  }

  public void setPlayState(boolean isPlay) {
    if (lyricView == null) return;
    lyricView.setToolbarPlayState(isPlay);
  }
}

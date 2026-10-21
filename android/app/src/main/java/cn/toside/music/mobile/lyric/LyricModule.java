package cn.toside.music.mobile.lyric;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;

public class LyricModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;
  Lyric lyric;
  // final Map<String, Object> constants = new HashMap<>();

  boolean isShowTranslation = false;
  boolean isShowRoma = false;
  float playbackRate = 1;

  private int listenerCount = 0;

  LyricModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    // constants.put("THEME_GREEN", "#07c556");
    // constants.put("THEME_YELLOW", "#fffa12");
    // constants.put("THEME_BLUE", "#19b5fe");
    // constants.put("THEME_RED", "#ff1222");
    // constants.put("THEME_PINK", "#f1828d");
    // constants.put("THEME_PURPLE", "#c851d4");
    // constants.put("THEME_ORANGE", "#fffa12");
    // constants.put("THEME_GREY", "#bdc3c7");
  }

  @Override
  public String getName() {
    return "LyricModule";
  }

//  @Override
//  public Map<String, Object> getConstants() {
//    return constants;
//  }

  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  @ReactMethod
  public void showDesktopLyric(ReadableMap data, Promise promise) {
    if (lyric == null) lyric = new Lyric(reactContext, isShowTranslation, isShowRoma, playbackRate);
    lyric.showDesktopLyric(Arguments.toBundle(data), promise);
  }

  @ReactMethod
  public void hideDesktopLyric(Promise promise) {
    if (lyric != null) lyric.hideDesktopLyric();
    promise.resolve(null);
  }

  @ReactMethod
  public void setSendLyricTextEvent(boolean isSend, Promise promise) {
    if (lyric == null) lyric = new Lyric(reactContext, isShowTranslation, isShowRoma, playbackRate);
    lyric.setSendLyricTextEvent(isSend);
    promise.resolve(null);
  }


  @ReactMethod
  public void setLyric(String lyric, String translation, String romaLyric, Promise promise) {
    // Log.d("Lyric", "set lyric: " + lyric);
    // Log.d("Lyric", "set lyric translation: " + translation);
    if (this.lyric != null) this.lyric.setLyric(lyric, translation, romaLyric);
    promise.resolve(null);
  }

  @ReactMethod
  public void setPlaybackRate(float playbackRate, Promise promise) {
    this.playbackRate = playbackRate;
    if (lyric != null) lyric.setPlaybackRate(playbackRate);
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleTranslation(boolean isShowTranslation, Promise promise) {
    this.isShowTranslation = isShowTranslation;
    if (lyric != null) lyric.toggleTranslation(isShowTranslation);
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleRoma(boolean isShowRoma, Promise promise) {
    this.isShowRoma = isShowRoma;
    if (lyric != null) lyric.toggleRoma(isShowRoma);
    promise.resolve(null);
  }

  @ReactMethod
  public void play(int time, Promise promise) {
    Log.d("Lyric", "play lyric: " + time);
    if (lyric != null) lyric.play(time);
    promise.resolve(null);
  }

  @ReactMethod
  public void pause(Promise promise) {
    Log.d("Lyric", "play pause");
    if (lyric != null) lyric.pauseLyric();
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleLock(boolean isLock, Promise promise) {
    if (lyric != null) {
      if (isLock) {
        lyric.lockLyric();
      } else {
        lyric.unlockLyric();
      }
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void pauseDesktopLyricView(Promise promise) {
    if (lyric != null) lyric.pauseDesktopLyricView();
    promise.resolve(null);
  }

  @ReactMethod
  public void resumeDesktopLyricView(Promise promise) {
    if (lyric != null) lyric.resumeDesktopLyricView();
    promise.resolve(null);
  }

  @ReactMethod
  public void setDesktopLyricPlayState(boolean isPlay, Promise promise) {
    if (lyric != null) lyric.setPlayState(isPlay);
    promise.resolve(null);
  }

  /** JS 下发工具条色板（单源在 JS 色板表，原生色块点击回传 index） */
  @ReactMethod
  public void setThemePalette(ReadableArray colors, Promise promise) {
    if (lyric != null && colors != null && colors.size() > 0) {
      int[] palette = new int[colors.size()];
      for (int i = 0; i < colors.size(); i++) palette[i] = colors.getInt(i);
      lyric.setThemePalette(palette);
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void setColor(String playedColor, Promise promise) {
    if (lyric != null) lyric.setPlayedColor(playedColor);
    promise.resolve(null);
  }

  /** 引导用户去系统通知设置（锁定解锁通知的死路修复：权限被拒后系统不再弹窗，只能引导） */
  @ReactMethod
  public void openNotificationSettings(Promise promise) {
    try {
      Intent intent = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
      intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, reactContext.getPackageName());
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      reactContext.startActivity(intent);
    } catch (Exception ignored) {
      // 页面不可达（罕见 ROM）静默忽略
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void setAlpha(float alpha, Promise promise) {
    if (lyric != null) lyric.setAlpha(alpha);
    promise.resolve(null);
  }

  @ReactMethod
  public void setTextSize(float size, Promise promise) {
    if (lyric != null) lyric.setTextSize(size);
    promise.resolve(null);
  }

  @ReactMethod
  public void setSingleLine(boolean singleLine, Promise promise) {
    if (lyric != null) lyric.setSingleLine(singleLine);
    promise.resolve(null);
  }

  @ReactMethod
  public void setShowToggleAnima(boolean showToggleAnima, Promise promise) {
    if (lyric != null) lyric.setShowToggleAnima(showToggleAnima);
    promise.resolve(null);
  }

  @ReactMethod
  public void checkOverlayPermission(Promise promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      promise.reject(new Exception("Permission denied"));
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void openOverlayPermissionActivity(Promise promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactContext.getApplicationContext().getPackageName()));
      reactContext.startActivityForResult(intent, 1, null);
    }
    promise.resolve(null);
  }

}

package com.shiyin.music.utils;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Rect;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;

import androidx.core.app.LocaleManagerCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.content.FileProvider;
import androidx.core.os.LocaleListCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.interfaces.ExtraWindowEventListener;
import com.facebook.react.views.view.WindowUtilKt;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

public class UtilsModule extends ReactContextBaseJavaModule implements com.facebook.react.bridge.LifecycleEventListener {
  private final ReactApplicationContext reactContext;

  private int listenerCount = 0;

  UtilsEvent utilsEvent;

  UtilsModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    utilsEvent = new UtilsEvent(reactContext);
    registerScreenBroadcastReceiver();
    reactContext.addLifecycleEventListener(this);
    reactContext.addExtraWindowEventListener(extraWindowListener);
  }

  @Override
  public String getName() {
    return "UtilsModule";
  }

  // FileProvider authority 按运行时包名拼装：debug 变体 applicationIdSuffix 下
  // 与 release 各自正确（manifest 占位符 ${applicationId}.provider），JS 侧勿硬编码
  @Override
  public Map<String, Object> getConstants() {
    final Map<String, Object> constants = new HashMap<>();
    Context context = getReactApplicationContext();
    if (context != null) {
      constants.put("fileProviderAuthority", context.getPackageName() + ".provider");
    }
    return constants;
  }

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

  private void registerScreenBroadcastReceiver() {
    final IntentFilter theFilter = new IntentFilter();
    /** System Defined Broadcast */
    theFilter.addAction(Intent.ACTION_SCREEN_ON);
    theFilter.addAction(Intent.ACTION_SCREEN_OFF);

    BroadcastReceiver screenOnOffReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        String strAction = intent.getAction();

        WritableMap params = Arguments.createMap();

        switch (Objects.requireNonNull(strAction)) {
          case Intent.ACTION_SCREEN_OFF:

            params.putString("state", "OFF");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
          case Intent.ACTION_SCREEN_ON:
            params.putString("state", "ON");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
        }
      }
    };

    reactContext.registerReceiver(screenOnOffReceiver, theFilter);
  }

  @ReactMethod
  public void exitApp() {
    // https://github.com/wumke/react-native-exit-app/blob/master/android/src/main/java/com/github/wumke/RNExitApp/RNExitAppModule.java
    // android.os.Process.killProcess(android.os.Process.myPid());

    // https://stackoverflow.com/questions/6330200/how-to-quit-android-application-programmatically
    Activity currentActivity = reactContext.getCurrentActivity();
    Log.d("Utils", "Exit app...");
    if (currentActivity == null) {
      Log.d("Utils", "killProcess");
      android.os.Process.killProcess(android.os.Process.myPid());
    } else {
      currentActivity.finishAndRemoveTask();
      System.exit(0);
    }
  }

  @ReactMethod
  public void getSupportedAbis(Promise promise) {
    // https://github.com/react-native-device-info/react-native-device-info/blob/ff8f672cb08fa39a887567d6e23e2f08778e8340/android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java#L877
    WritableArray array = new WritableNativeArray();
    for (String abi : Build.SUPPORTED_ABIS) {
      array.pushString(abi);
    }
    promise.resolve(array);
  }

  @ReactMethod
  public void installApk(String filePath, String fileProviderAuthority, Promise promise) {
    // https://github.com/mikehardy/react-native-update-apk/blob/master/android/src/main/java/net/mikehardy/rnupdateapk/RNUpdateAPK.java
    File file = new File(filePath);
    if (!file.exists()) {
      Log.e("Utils", "installApk: file doe snot exist '" + filePath + "'");
      // FIXME this should take a promise and fail it
      promise.reject("Utils", "installApk: file doe snot exist '" + filePath + "'");
      return;
    }

    if (Build.VERSION.SDK_INT >= 24) {
      // API24 and up has a package installer that can handle FileProvider content:// URIs
      Uri contentUri;
      try {
        contentUri = FileProvider.getUriForFile(getReactApplicationContext(), fileProviderAuthority, file);
      } catch (Exception e) {
        // FIXME should be a Promise.reject really
        Log.e("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'", e);
        promise.reject("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'");
        return;
        // throw e;
      }
      Intent installApp = new Intent(Intent.ACTION_INSTALL_PACKAGE);
      installApp.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      installApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      installApp.setData(contentUri);
      installApp.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, reactContext.getApplicationInfo().packageName);
      reactContext.startActivity(installApp);
      promise.resolve(null);
    } else {
      // Old APIs do not handle content:// URIs, so use an old file:// style
      String cmd = "chmod 777 " + file;
      try {
        Runtime.getRuntime().exec(cmd);
      } catch (Exception e) {
        // e.printStackTrace();
        Log.e("Utils", "installApk exception : " + e.getMessage(), e);
        promise.reject("Utils", e.getMessage());
      }
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      intent.setDataAndType(Uri.parse("file://" + file), "application/vnd.android.package-archive");
      reactContext.startActivity(intent);
      promise.resolve(null);
    }
  }

  @ReactMethod
  public void screenkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  @ReactMethod
  public void screenUnkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  /**
   Gets the device's WiFi interface IP address
   @return device's WiFi IP if connected to WiFi, else '0.0.0.0'
   */
  @ReactMethod
  public void getWIFIIPV4Address(final Promise promise) throws Exception {
    // https://github.com/pusherman/react-native-network-info/blob/master/android/src/main/java/com/pusherman/networkinfo/RNNetworkInfo.java
    WifiManager wifi = (WifiManager) reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    new Thread(new Runnable() {
      public void run() {
        try {
          WifiInfo info = wifi.getConnectionInfo();
          int ipAddress = info.getIpAddress();
          @SuppressLint("DefaultLocale") String stringip = String.format("%d.%d.%d.%d", (ipAddress & 0xff), (ipAddress >> 8 & 0xff),
            (ipAddress >> 16 & 0xff), (ipAddress >> 24 & 0xff));
          promise.resolve(stringip);
        }catch (Exception e) {
          promise.resolve(null);
        }
      }
    }).start();
  }

  // https://stackoverflow.com/a/26117646
  @ReactMethod
  public void getDeviceName(final Promise promise) {
    String manufacturer = Build.MANUFACTURER;
    String model = Build.MODEL;
    if (model.startsWith(manufacturer)) {
      promise.resolve(capitalize(model));
    } else {
      promise.resolve(capitalize(manufacturer) + " " + model);
    }
  }

  // 稳定设备标识（SSAID）：同签名键卸载重装保持不变（净屏同机制）——拾音 device_id 稳定源，
  // 走查反馈批（uuid 存储态卸载即失→dev 席位爆/权益丢）。读取异常/空值 resolve 空串，
  // 调用方（auth.getDeviceId）回退 uuid 兜底
  @ReactMethod
  public void getAndroidId(final Promise promise) {
    try {
      String androidId = android.provider.Settings.Secure.getString(
          reactContext.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
      promise.resolve(androidId == null ? "" : androidId);
    } catch (Exception e) {
      promise.resolve("");
    }
  }
  private String capitalize(String s) {
    if (s == null || s.isEmpty()) {
      return "";
    }
    char first = s.charAt(0);
    if (Character.isUpperCase(first)) {
      return s;
    } else {
      return Character.toUpperCase(first) + s.substring(1);
    }
  }

  @ReactMethod
  public void isNotificationsEnabled(final Promise promise) {
    new Thread(() -> {
      boolean enabled = NotificationPermissionUtil.isNotificationsEnabled(
        reactContext.getApplicationContext());
      promise.resolve(enabled);
    }).start();
  }

  @ReactMethod
  public void openNotificationPermissionActivity(Promise promise) {
    new Thread(() -> {
      boolean result = NotificationPermissionUtil.openNotificationPermissionActivity(
        reactContext.getApplicationContext());
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void shareText(String shareTitle, String title, String text) {
    Intent shareIntent = new Intent(Intent.ACTION_SEND);
    shareIntent.setType("text/plain");
    shareIntent.putExtra(Intent.EXTRA_TEXT,text);
    shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
    Objects.requireNonNull(reactContext.getCurrentActivity()).startActivity(Intent.createChooser(shareIntent, shareTitle));
  }

  // https://stackoverflow.com/questions/73463341/in-per-app-language-how-to-get-app-locale-in-api-33-if-system-locale-is-diffe
  @ReactMethod
  public void getSystemLocales(Promise promise) {
    Locale locale = null;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      LocaleListCompat list = LocaleManagerCompat.getSystemLocales(reactContext);
      if (!list.isEmpty()) {
        locale = list.get(0);
      } else {
        promise.resolve(null);
        return;
      }
    } else {
      locale = Locale.getDefault();
    }
    if (locale == null) {
      promise.resolve("");
      return;
    }

    // 格式化成 zh_cn、en_us 等
    String language = locale.getLanguage(); // zh, en
    String country = locale.getCountry();   // CN, US
    String localeStr;

    if (!country.isEmpty()) {
      localeStr = language.toLowerCase() + "_" + country.toLowerCase();
    } else {
      localeStr = language.toLowerCase();
    }

    promise.resolve(localeStr);
  }

  // https://github.com/Anthonyzou/react-native-full-screen/blob/master/android/src/main/java/com/rn/full/screen/FullScreen.java
  //  @ReactMethod
  //  public void onFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION // hide nav bar
  //          | View.SYSTEM_UI_FLAG_FULLSCREEN // hide status bar
  //          | View.SYSTEM_UI_FLAG_IMMERSIVE
  //      );
  //    });
  //  }
  //  @ReactMethod
  //  public void offFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //      );
  //    });
  //  }

  // edge-to-edge（弹窗体系批 §问题2）：导航栏 inset 读取/监听与生命周期自愈
  // 批4审查 I-2：activity 进程内重建后新 decorView 无监听，onHostResume 幂等重挂并回放当前值
  private int lastNavBottom = -1;
  private int lastNavRight = -1;
  private int lastImeBottom = -1;

  @Override
  public void onHostResume() {
    // activity 重建/回到前台后重挂 inset 监听并回放当前值（幂等）
    watchWindowInsets();
  }

  @Override
  public void onHostPause() {
  }

  @Override
  public void onHostDestroy() {
  }
  @ReactMethod
  public void getNavigationBarInset(Promise promise) {
    Activity currentActivity = reactContext.getCurrentActivity();
    android.view.WindowInsets rawInsets = currentActivity == null ? null : currentActivity.getWindow().getDecorView().getRootWindowInsets();
    if (rawInsets == null) {
      promise.resolve(0);
      return;
    }
    WindowInsetsCompat insets = WindowInsetsCompat.toWindowInsetsCompat(rawInsets);
    promise.resolve(insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom);
  }

  // Modal Dialog 窗口 ime inset 监听（2026-10-16 键盘避让定案，替代已删的 getImeBottom 轮询插桩）：
  // Android 15+（targetSdk 36）e2e 系统强制，Modal 恒 edge-to-edge——ADJUST_RESIZE 被忽略、
  // RN Keyboard 事件不派发（CustomGlobalLayoutListener 只挂主窗口）。经 RN 官方 ExtraWindowEventListener
  // 拿到每个 Modal Dialog 窗口，挂 WindowInsetsAnimation 逐帧推 ime 高度给 JS（SheetBase 抬升）。
  // Android 14- 上 Modal 非 e2e、系统 resize 自动抬升（ime insets 被消费恒 0），不挂避免与
  // ReactModalHostView 的 setStatusBarTranslucency 抢 decorView 的 onApplyWindowInsets 单槽。
  private int lastDialogIme = -1;
  // 存活 Modal Dialog 窗口栈（嵌套确认弹窗时栈顶为最新窗口）：穿透取栈顶存活窗口——
  // 单字段会在嵌套弹窗销毁时被清空导致主流程穿透失效（三席审查 #4）；destroy 按实例移除
  private final java.util.concurrent.CopyOnWriteArrayList<Window> dialogWindows =
    new java.util.concurrent.CopyOnWriteArrayList<>();

  // 弹层玻璃 arm 时间戳（毛玻璃全体系阶段二，方案 §2.2，consume-once+新鲜度守卫）：JS show 前
  // 置位，下一个创建的 dialog 窗口消费——时间戳超窗（1s，桥往返+窗口创建远小于此）视为滞留
  // 自动失效，防「重复 setVisible(true) 被 Modal 短路 → arm 滞留 → 被后续无关弹窗误消费」把
  // blur 挂到实色警示弹窗上（审查优化师 I-1）。只有弹层族（SheetBase/Menu）arm，
  // Dialog/ConfirmAlert/Loading 等实色警示窗口不受波及（方案 §4 不玻璃清单）
  private static final long DIALOG_BLUR_ARM_FRESH_MS = 1000;
  private volatile long dialogBlurBehindArmedAt = 0;

  // blur-behind 挂窗（C-1 拍板 A）：窗口级属性，观感=弹层打开时背景全域模糊——iOS sheet 同构；
  // 压暗仍由 JS 自绘 MASK_COLOR 承担，不启用系统 FLAG_DIM_BEHIND（遮罩/键盘避让机制零接触，
  // 方案 §2.2）。API<31 静默跳过；系统关闭态（省电模式等）引擎自动失效，JS 侧经
  // isDialogBlurBehindEnabled 同步回退实色底板
  private void applyDialogBlurBehind(Window window) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
    try {
      float density = reactContext.getResources().getDisplayMetrics().density;
      WindowManager.LayoutParams attrs = window.getAttributes();
      // API 36 桩 blurBehindRadius 字段已隐藏，走 accessor（javap 实证 setBlurBehindRadius(int)）
      attrs.setBlurBehindRadius((int) (20 * density));
      window.setAttributes(attrs);
      window.addFlags(WindowManager.LayoutParams.FLAG_BLUR_BEHIND);
    } catch (Exception e) {
      Log.e("UtilsModule", "applyDialogBlurBehind failed", e);
    }
  }

  private final ExtraWindowEventListener extraWindowListener = new ExtraWindowEventListener() {
    @Override
    public void onExtraWindowCreate(Window window) {
      dialogWindows.add(window);
      if (dialogBlurBehindArmedAt > 0) {
        long armedAt = dialogBlurBehindArmedAt;
        dialogBlurBehindArmedAt = 0;
        if (SystemClock.uptimeMillis() - armedAt <= DIALOG_BLUR_ARM_FRESH_MS) {
          applyDialogBlurBehind(window);
        }
      }
      if (!WindowUtilKt.isEdgeToEdgeFeatureFlagOn()) return;
      View decorView = window.getDecorView();
      ViewCompat.setWindowInsetsAnimationCallback(decorView,
        new WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
          @Override
          public WindowInsetsCompat onProgress(WindowInsetsCompat insets, List<WindowInsetsAnimationCompat> runningAnimations) {
            emitDialogIme(insets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
            return insets;
          }
        });
      // 终态兜底（无动画跳变路径），与动画通道同值去重
      ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, windowInsets) -> {
        emitDialogIme(windowInsets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
        return windowInsets;
      });
      // Dialog 窗口获得焦点时若已有聚焦 view（JS onShow 的 focus 已设 view 焦点，仅 IME 请求
      // 被 show 前的 FLAG_NOT_FOCUSABLE 吞掉），立即重发 showSoftInput——键盘启动从 JS 300ms
      // 兜底提前到窗口焦点就绪（~100ms），与 sheet 上滑重叠成一阶段（真机反馈 2026-10-16）
      decorView.getViewTreeObserver().addOnWindowFocusChangeListener(hasFocus -> {
        if (!hasFocus) return;
        View focused = decorView.findFocus();
        if (focused == null) return;
        InputMethodManager imm = (InputMethodManager) reactContext.getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) imm.showSoftInput(focused, 0);
      });
      // 键盘弹着首击放行实验（2026-10-19，doc/plans/modal-wrap-content-window.md）：包装窗口
      // callback，ACTION_DOWN 焦点在输入框且点击在其外时自收键盘但不消费事件——收键盘与点击
      // 一步完成；SheetInputProbe 日志同时验证首击是否到达窗口层级（无记录=系统层已吞，app 侧
      // 无解，转小窗形态方案）
      Window.Callback originalCallback = window.getCallback();
      // 重入防御（三席审查 S-2）：onExtraWindowCreate 对同一 window 重复触发时不叠加包装链
      if (originalCallback != null && !(originalCallback instanceof KeyboardPassThroughCallback)) {
        window.setCallback(new KeyboardPassThroughCallback(originalCallback, decorView));
      }
    }

    @Override
    public void onExtraWindowDestroy(Window window) {
      // decorView 随窗口销毁，无需解挂；重置去重基线防跨窗口粘连
      lastDialogIme = -1;
      dialogWindows.remove(window);
    }
  };

  // 关闭退场期让 Modal Dialog 窗口触摸穿透（FLAG_NOT_TOUCHABLE）：sheet 下滑动画期间窗口
  // 不再拦截底层页面触摸，主页立即可滑，不必等动画放完 Dialog 销毁（真机反馈 2026-10-16）。
  // 取栈顶存活窗口（嵌套确认弹窗销毁后仍能命中 InputSheet 自身）；每次 show 都是新 Dialog，
  // flags 不跨会话残留
  @ReactMethod
  public void makeDialogTouchPassthrough() {
    Window window = dialogWindows.isEmpty() ? null : dialogWindows.get(dialogWindows.size() - 1);
    Activity activity = reactContext.getCurrentActivity();
    // activity 判空：后台期关闭弹层时可为 null（三席审查 #1，对齐同文件 watchWindowInsets 惯例）
    if (window == null || activity == null) return;
    activity.runOnUiThread(() ->
      window.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE));
  }

  // show 前置位（consume-once+新鲜度守卫）：置位下一个创建的 dialog 窗口的 blur-behind arm，
  // 并同调用返回当刻跨窗模糊可用性（arm+probe 单次桥往返，审查优化师 S-2）
  @ReactMethod
  public void armDialogBlurBehind(Promise promise) {
    dialogBlurBehindArmedAt = SystemClock.uptimeMillis();
    Activity activity = reactContext.getCurrentActivity();
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(false);
      return;
    }
    promise.resolve(activity.getWindow().getWindowManager().isCrossWindowBlurEnabled());
  }

  // JS 侧面板底色分流（玻璃 tint vs 实色）：API<31 或系统跨窗模糊关闭（省电模式等）=false。
  // 主窗口 WindowManager 取 isCrossWindowBlurEnabled（系统全局开关，dialog 窗口同源）
  @ReactMethod
  public void isDialogBlurBehindEnabled(Promise promise) {
    Activity activity = reactContext.getCurrentActivity();
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(false);
      return;
    }
    promise.resolve(activity.getWindow().getWindowManager().isCrossWindowBlurEnabled());
  }

  private void emitDialogIme(int imeBottom) {
    if (imeBottom == lastDialogIme) return;
    lastDialogIme = imeBottom;
    WritableMap params = Arguments.createMap();
    params.putInt("imeBottom", imeBottom);
    utilsEvent.sendEvent(utilsEvent.DIALOG_IME_CHANGED, params);
  }

  // ime/navigationBars inset 变化监听：decorFitsSystemWindows(false) 后 adjustResize 失效，
  // 由原生推事件给 JS 补偿（键盘顶起/底部 inset 垫高）。JS 启动时调用一次；onHostResume 自愈重挂。
  // 值变化才发（批4审查：键盘动画期逐帧分发防事件风暴）
  @ReactMethod
  public void watchWindowInsets() {
    Activity currentActivity = reactContext.getCurrentActivity();
    if (currentActivity == null) return;
    currentActivity.runOnUiThread(() -> {
      ViewCompat.setOnApplyWindowInsetsListener(currentActivity.getWindow().getDecorView(), (v, windowInsets) -> {
        Insets navInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
        Insets imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
        if (navInsets.bottom == lastNavBottom && navInsets.right == lastNavRight && imeInsets.bottom == lastImeBottom) {
          return windowInsets;
        }
        lastNavBottom = navInsets.bottom;
        lastNavRight = navInsets.right;
        lastImeBottom = imeInsets.bottom;
        WritableMap params = Arguments.createMap();
        params.putInt("navBarBottom", navInsets.bottom);
        params.putInt("navBarRight", navInsets.right);
        params.putInt("imeBottom", imeInsets.bottom);
        utilsEvent.sendEvent(utilsEvent.WINDOW_INSETS_CHANGED, params);
        return windowInsets;
      });
      // 挂载即回放当前值（JS 侧原生通道立即激活）
      android.view.WindowInsets raw = currentActivity.getWindow().getDecorView().getRootWindowInsets();
      if (raw != null) {
        WindowInsetsCompat current = WindowInsetsCompat.toWindowInsetsCompat(raw);
        Insets navInsets = current.getInsets(WindowInsetsCompat.Type.navigationBars());
        Insets imeInsets = current.getInsets(WindowInsetsCompat.Type.ime());
        WritableMap params = Arguments.createMap();
        params.putInt("navBarBottom", navInsets.bottom);
        params.putInt("navBarRight", navInsets.right);
        params.putInt("imeBottom", imeInsets.bottom);
        utilsEvent.sendEvent(utilsEvent.WINDOW_INSETS_CHANGED, params);
        lastNavBottom = navInsets.bottom;
        lastNavRight = navInsets.right;
        lastImeBottom = imeInsets.bottom;
      }
    });
  }

  @ReactMethod
  public void getWindowSize(Promise promise) {
    WritableMap params = Arguments.createMap();

    Activity currentActivity = reactContext.getCurrentActivity();
    if (currentActivity == null) {
      params.putInt("width", 0);
      params.putInt("height", 0);
      promise.resolve(params);
      return;
    }
    // 获取当前应用可用区域大小
    Window window = currentActivity.getWindow();
    Rect rect = new Rect();
    window.getDecorView().getWindowVisibleDisplayFrame(rect);
    params.putInt("width", rect.width());
    params.putInt("height", rect.height());
    promise.resolve(params);
  }

  @ReactMethod
  public void isIgnoringBatteryOptimization(Promise promise) {
    new Thread(() -> {
      boolean result = BatteryOptimizationUtil.isIgnoringBatteryOptimization(
        reactContext.getApplicationContext(),
        reactContext.getPackageName()
      );
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void requestIgnoreBatteryOptimization(Promise promise) {
    new Thread(() -> {
      try {
        boolean result = BatteryOptimizationUtil.requestIgnoreBatteryOptimization(
          reactContext.getApplicationContext(),
          reactContext.getPackageName()
        );
        promise.resolve(result);
      } catch (Exception e) {
        promise.reject("ERROR", e);
      }
    }).start();
  }
}


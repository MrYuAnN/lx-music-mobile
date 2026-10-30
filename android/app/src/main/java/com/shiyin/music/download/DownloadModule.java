package com.shiyin.music.download;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.media.MediaScannerConnection;
import android.os.Build;
import android.os.Environment;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

// 下载/存储辅助（multifix 问题 3/4）：权限判定、Wi-Fi 状态、扫描入库。
// targetSdk 29 + requestLegacyExternalStorage 全程 legacy 视图，
// isExternalStorageManager() 只反映「所有文件访问」开关（API 30+），与老权限判定混合使用。
public class DownloadModule extends ReactContextBaseJavaModule {
  DownloadModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "DownloadSupport";
  }

  /** API 30+ 「所有文件访问权限」开关状态；API < 30 恒 false（无此机制） */
  @ReactMethod
  public void isExternalStorageManager(Promise promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(false);
      return;
    }
    promise.resolve(Environment.isExternalStorageManager());
  }

  /** 应用包名（授权页 intent 直达本应用开关页用；debug 构建含后缀） */
  @ReactMethod
  public void getPackageName(Promise promise) {
    promise.resolve(getReactApplicationContext().getPackageName());
  }

  /**
   * 直跳本应用「所有文件访问权限」开关页（API 30+）。
   * JS 侧 Linking.openURL 对无 scheme 的 settings action 解析不出可匹配 intent，恒落兜底——
   * 原生 startActivity 带 package data 才能直达（架构师 I8 修复）；失败 reject 由 JS 落 openSettings。
   */
  @ReactMethod
  public void openAllFilesAccessSettings(Promise promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.reject("UNSUPPORTED", "MANAGE_EXTERNAL_STORAGE requires API 30+");
      return;
    }
    try {
      android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
      intent.setData(android.net.Uri.fromParts("package", getReactApplicationContext().getPackageName(), null));
      intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
      getReactApplicationContext().startActivity(intent);
      promise.resolve(true);
    } catch (Exception e) {
      // 二级兜底（2026-10-30 弹窗批定稿/审查 S-5）：带 package 的直达开关页被 ROM 拦截时，
      // 退全局「所有文件访问」应用列表页（用户需手动找到本应用）；仍失败才 reject 走 JS 分级引导
      try {
        android.content.Intent fallback = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
        fallback.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        getReactApplicationContext().startActivity(fallback);
        promise.resolve(true);
      } catch (Exception e2) {
        promise.reject("FAILED", e2);
      }
    }
  }

  /** 检查运行时权限是否已授（不弹窗） */
  @ReactMethod
  public void checkPermission(String permission, Promise promise) {
    boolean granted = ContextCompat.checkSelfPermission(getReactApplicationContext(), permission)
      == PackageManager.PERMISSION_GRANTED;
    promise.resolve(granted);
  }

  /** 当前是否 Wi-Fi 网络 */
  @ReactMethod
  public void isWifi(Promise promise) {
    ConnectivityManager cm = (ConnectivityManager) getReactApplicationContext()
      .getSystemService(Context.CONNECTIVITY_SERVICE);
    if (cm == null) {
      promise.resolve(false);
      return;
    }
    @SuppressWarnings("deprecation")
    NetworkInfo info = cm.getActiveNetworkInfo();
    promise.resolve(info != null && info.isConnected() && info.getType() == ConnectivityManager.TYPE_WIFI);
  }

  /** 通知系统媒体库扫描文件（下载完成后入库） */
  @ReactMethod
  public void scanFile(String path, Promise promise) {
    MediaScannerConnection.scanFile(getReactApplicationContext(), new String[]{ path }, null,
      (s, uri) -> promise.resolve(uri != null ? uri.toString() : null));
  }
}

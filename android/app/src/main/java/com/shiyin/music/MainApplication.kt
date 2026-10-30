package com.shiyin.music

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

import com.shiyin.music.cache.CachePackage
import com.shiyin.music.crypto.CryptoPackage
import com.shiyin.music.download.DownloadPackage
import com.shiyin.music.lyric.LyricPackage
import com.shiyin.music.utils.UtilsPackage

// N2：0.86 模板（ReactHost + loadReactNative，取代 ReactNativeHost 体系）；
// 自研六模块手动注册自 N1 平移，interop 装机验证
class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(CachePackage())
          add(LyricPackage())
          add(UtilsPackage())
          add(CryptoPackage())
          add(DownloadPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}

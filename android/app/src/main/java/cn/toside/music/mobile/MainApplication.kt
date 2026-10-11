package cn.toside.music.mobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

import cn.toside.music.mobile.cache.CachePackage
import cn.toside.music.mobile.crypto.CryptoPackage
import cn.toside.music.mobile.download.DownloadPackage
import cn.toside.music.mobile.lyric.LyricPackage
import cn.toside.music.mobile.userApi.UserApiPackage
import cn.toside.music.mobile.utils.UtilsPackage

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
          add(UserApiPackage())
          add(DownloadPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}

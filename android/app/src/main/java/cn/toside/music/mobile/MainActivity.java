package cn.toside.music.mobile;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

// N1 导航迁移：RNN NavigationActivity → 标准 ReactActivity（组件名=app.json "shiyin"）
public class MainActivity extends ReactActivity {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "shiyin";
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // 弹窗体系批 §问题2：真 edge-to-edge（RNN 7.x 未支持，窗口级手动开启）——
    // 内容延伸到系统栏底下、导航栏透明；insets 经 UtilsModule 推给 JS 自行适配。
    // 保留至 N2（RN 0.77+ 原生 edge-to-edge 接管后退役）
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);
  }

  /**
   * Returns the instance of the {@link ReactActivityDelegate}. Here we use a util class {@link
   * DefaultReactActivityDelegate} which allows you to enable New Architecture and Fabric
   * components.
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        // If you opted-in for the New Architecture, we enable the Fabric Executor.
        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED);
  }
}

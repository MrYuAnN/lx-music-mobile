package cn.toside.music.mobile;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.reactnativenavigation.NavigationActivity;

public class MainActivity extends NavigationActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // 弹窗体系批 §问题2：真 edge-to-edge（RNN 7.x 未支持，窗口级手动开启）——
    // 内容延伸到系统栏底下、导航栏透明；insets 经 UtilsModule 推给 JS 自行适配
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);
  }
}

package cn.toside.music.mobile.lyric;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;

import cn.toside.music.mobile.R;

// 锁定期间的解锁通知（项目无前台服务/媒体通知，载体为独立低优先级通知）：
// action「解锁」→ 动态 receiver（NOT_EXPORTED）→ Lyric.unlockLyric + lock-changed 事件同步 JS 设置。
public class DesktopLyricNotification {
  public static final String ACTION_UNLOCK_DESKTOP_LYRIC = "cn.toside.music.mobile.action.UNLOCK_DESKTOP_LYRIC";
  private static final String CHANNEL_ID = "desktop_lyric";
  private static final int NOTIFICATION_ID = 1001;

  public static void show(Context context) {
    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    // 权限未授予：静默跳过（主链路在 JS 锁定动作时已就地请求，拒绝后走 App 内解锁兜底）
    if (manager == null || !manager.areNotificationsEnabled()) return;

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
        context.getString(R.string.desktop_lyric_channel_name), NotificationManager.IMPORTANCE_LOW);
      channel.setShowBadge(false);
      manager.createNotificationChannel(channel);
    }

    Intent unlockIntent = new Intent(ACTION_UNLOCK_DESKTOP_LYRIC);
    unlockIntent.setPackage(context.getPackageName());
    PendingIntent unlockPendingIntent = PendingIntent.getBroadcast(context, 0, unlockIntent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

    Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    PendingIntent contentPendingIntent = null;
    if (launchIntent != null) {
      contentPendingIntent = PendingIntent.getActivity(context, 0, launchIntent,
        PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? new Notification.Builder(context, CHANNEL_ID)
      : new Notification.Builder(context);
    builder.setSmallIcon(R.drawable.ic_lyric_tb_lock)
      .setContentTitle(context.getString(R.string.desktop_lyric_locked_title))
      .setContentText(context.getString(R.string.desktop_lyric_locked_text))
      .setOngoing(true)
      .setContentIntent(contentPendingIntent)
      .addAction(new Notification.Action.Builder(Icon.createWithResource(context, R.drawable.ic_lyric_tb_lock),
        context.getString(R.string.desktop_lyric_unlock), unlockPendingIntent).build());
    manager.notify(NOTIFICATION_ID, builder.build());
  }

  public static void cancel(Context context) {
    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null) manager.cancel(NOTIFICATION_ID);
  }
}

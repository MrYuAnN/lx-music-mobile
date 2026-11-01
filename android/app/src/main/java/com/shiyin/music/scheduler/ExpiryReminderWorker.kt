/*
 * 到期本地通知（净屏 ExpiryReminderWorker 同款移植，2026-11-01 D2 拍板：原生
 * WorkManager 整套；决策 #20：读本地 Receipt，到期窗口发本地通知，零推送通道/
 * 服务端依赖）。
 *
 * 双窗双 key（2026-11-01 三角色审查拍板，对标业界订阅多次触达惯例——到期前/
 * 到期后两段触达，替代净屏单窗单次口径）：到期前 pre 窗一次「即将到期」+
 * 已到期 post 窗一次「已过期」；各窗独立防重 key 记到期值，续费后到期值变化
 * 自动重置可再提醒。POST_NOTIFICATIONS（API 33+）未授权时通知静默跳过，不阻塞
 * 主流程（授权入口=RN 侧首播一次性请求 + 设置页找回，走查 F-4 既有拍板）。
 *
 * 继承边界（审查 I-1 降级登记）：isTrial 单值取自 SDK computeCurrent 聚合元数据
 * （锚「首个未停权的码」），试用码+正价码并存时档位可能继承旧试用码——常规
 * 路径已被三层清理兜住（pruneOrphanedKeys 孤儿清理 2026-08-24 拍板 / merge 融合
 * 吸收 / 6h 巡检 binding-check 停权），仅剩激活成功但 prune 前进程被杀等异常
 * 残留边角，SDK 侧正式修法=聚合改 paid>trial 优先级（单源，登记 INTEGRATIONS）。
 * 时钟口径（审查 S-6）：本 Worker 用裸系统时钟，与 SDK 判态的
 * effectiveNowSeconds（时钟回拨防护）存在分叉，影响仅通知时机异常，无资损。
 *
 * 提醒窗口（pre=试用 <36h / 正价 7d；post=试用 3d / 正价 7d）：24h 周期与 24h
 * 窗口同宽会大概率滑过，36h 保证至少一次有效送达（净屏 2026-10-13 拍板同口径）。
 * 显示名映射=宿主私有（SDK PlanSkus.APP_CN 为净屏 app 集，展示层键表归属宿主，
 * 同 RN 侧 core/shiyin/activation APP_CN 口径）；键域外 app 不发（审查 S-7：
 * 防替未知 app 发英文键名通知）。
 */
package com.shiyin.music.scheduler

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.shiyin.music.MainActivity
import com.shiyin.music.R
import top.astock.activation.EntitlementManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class ExpiryReminderWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val st = EntitlementManager.current(ctx)
        if (st is EntitlementManager.State.Unactivated) return Result.success()
        val ent = (st as? EntitlementManager.State.Active)?.e ?: (st as EntitlementManager.State.Expired).e
        val now = System.currentTimeMillis() / 1000
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val isTrial = ent.isTrial()
        val preWindowSec = if (isTrial) TRIAL_PRE_WINDOW_HOURS * 3600L else PRE_WINDOW_DAYS * 86400L
        val postWindowSec = if (isTrial) TRIAL_POST_WINDOW_DAYS * 86400L else POST_WINDOW_DAYS * 86400L
        for ((app, exp) in ent.expiries) {
            if (exp == 0L) continue // 永久不提醒
            if (app !in APP_CN) continue // 键域外不发（S-7）
            // 双窗分支：pre=尚未到期落窗；post=已到期滑窗内补发（Worker 被 Doze 延迟
            // 数日时 pre 窗滑走，post 窗接住 win-back，不再依赖无下界补发）
            if (exp > now) {
                if (exp - now > preWindowSec) continue
                if (p.getLong(preKey(app), 0L) == exp) continue // 该到期值已提醒过
                if (notifyExpiry(ctx, app, exp, isTrial, expired = false)) {
                    p.edit().putLong(preKey(app), exp).apply()
                }
            } else {
                if (now - exp > postWindowSec) continue
                if (p.getLong(postKey(app), 0L) == exp) continue
                if (notifyExpiry(ctx, app, exp, isTrial, expired = true)) {
                    p.edit().putLong(postKey(app), exp).apply()
                }
            }
        }
        return Result.success()
    }

    /** 发到期通知；未授权/异常时静默跳过（不阻塞主流程）。isTrial/expired 走四态文案 */
    private fun notifyExpiry(ctx: Context, app: String, expUnixSec: Long, isTrial: Boolean, expired: Boolean): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return false // 拒绝授权：静默跳过
        }
        return runCatching {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= 26) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, ctx.getString(R.string.expiry_notify_channel), NotificationManager.IMPORTANCE_DEFAULT)
                )
            }
            val appCN = APP_CN[app] ?: app
            val date = SimpleDateFormat("yyyy-MM-dd", Locale.CHINA).format(Date(expUnixSec * 1000))
            val (titleRes, bodyRes) = when {
                isTrial && expired -> R.string.trial_expired_title to R.string.trial_expired_body
                isTrial -> R.string.trial_expiry_notify_title to R.string.trial_expiry_notify_body
                expired -> R.string.expiry_expired_title to R.string.expiry_expired_body
                else -> R.string.expiry_notify_title to R.string.expiry_notify_body
            }
            val title = ctx.getString(titleRes)
            val body = if (isTrial) ctx.getString(bodyRes, appCN) else ctx.getString(bodyRes, appCN, date)
            val contentIntent = PendingIntent.getActivity(
                ctx, 0,
                // SINGLE_TOP 防通知点击叠栈（净屏审查 S6）；data=deeplink 直达我的激活码
                // （审查 S-3，RN 侧 Linking 收 intent data 路由，审查时实证 pushRoute 有
                // isReady 保护，冷启动点击不崩）
                Intent(ctx, MainActivity::class.java)
                    .setData(Uri.parse(DEEP_LINK_ACTIVATION))
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
                // 专用白 alpha 小图标（审查 S-2 提前修）：状态栏按 alpha 蒙版渲染，
                // 彩色 launcher 图标会退化为灰白块（Android 5.0+ 行为）
                .setSmallIcon(R.drawable.ic_notify_expiry)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
            nm.notify(app.hashCode() and 0x7fffffff, notification)
            true
        }.getOrDefault(false)
    }

    companion object {
        private const val PREFS = "shiyin"
        private const val CHANNEL_ID = "shiyin_membership_expiry"
        private val APP_CN = mapOf("shiyin" to "QQ音乐")
        private const val PRE_WINDOW_DAYS = 7L
        private const val TRIAL_PRE_WINDOW_HOURS = 36L
        private const val POST_WINDOW_DAYS = 7L
        private const val TRIAL_POST_WINDOW_DAYS = 3L
        const val DEEP_LINK_ACTIVATION = "shiyin://activation/open"
        const val PERIOD_HOURS = 24L
        const val WORK_NAME = "shiyin_expiry_reminder"

        private fun preKey(app: String) = "expiry_notified_pre_$app"
        private fun postKey(app: String) = "expiry_notified_post_$app"
    }
}

/** 周期调度（幂等；UPDATE 对齐 SDK EntitlementSyncScheduler 先例——改周期/约束时
 *  存量设备 spec 随之更新，KEEP 会摸不到旧任务致调整不生效，审查 S-1） */
object ExpiryReminderScheduler {
    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<ExpiryReminderWorker>(ExpiryReminderWorker.PERIOD_HOURS, TimeUnit.HOURS)
            .build()
        WorkManager.getInstance(context.applicationContext)
            .enqueueUniquePeriodicWork(
                ExpiryReminderWorker.WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
    }
}

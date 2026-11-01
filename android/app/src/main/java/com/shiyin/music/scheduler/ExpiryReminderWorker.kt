/*
 * 到期本地通知（净屏 ExpiryReminderWorker 同款移植，2026-11-01 D2 拍板：原生
 * WorkManager 整套；决策 #20：读本地 Receipt，到期窗口发一次本地通知，零推送
 * 通道/服务端依赖）。
 *
 * 逻辑：任一源（app 键）的到期时间落进提醒窗口且 prefs 未提醒过（已提醒值==当前
 * 到期值）→ 发本地通知一次并记录。续费后到期值变化，自动重置可再提醒。
 * POST_NOTIFICATIONS（API 33+）未授权时通知静默跳过，不阻塞主流程。
 *
 * 提醒窗口按 tier 分支（净屏 2026-10-13 试用拍板同口径）：试用码（auto3）剩余
 * <36h 才提醒——本 Worker 24h 周期与 24h 窗口同宽会大概率滑过，36h 保证至少一次
 * 有效送达；已到期滑窗由无下界+防重 key 兜住补发一次。正价码维持 [已到期, +7d]
 * 历史窗口。显示名映射=宿主私有（SDK PlanSkus.APP_CN 为净屏 app 集，展示层
 * 键表归属宿主，同 RN 侧 core/shiyin/activation APP_CN 口径）。
 */
package com.shiyin.music.scheduler

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
        for ((app, exp) in ent.expiries) {
            if (exp == 0L) continue // 永久不提醒
            // 上界：正价 7 天；下界放宽到含「已到期」（Worker 被 Doze 延迟数日时窗口
            // 滑走导致漏发且永不补发——已到期未续费仍提示一次，防重 key 保证每个到期值
            // 只发一次）
            val windowSec = if (isTrial) TRIAL_WINDOW_HOURS * 3600L else WINDOW_TO_DAYS * 86400L
            if (exp > now + windowSec) continue
            val key = "expiry_notified_$app"
            if (p.getLong(key, 0L) == exp) continue // 该到期值已提醒过
            if (notifyExpiry(ctx, app, exp, isTrial)) {
                p.edit().putLong(key, exp).apply()
            }
        }
        return Result.success()
    }

    /** 发到期通知；未授权/异常时静默跳过（不阻塞主流程）。isTrial 走试用独立文案 */
    private fun notifyExpiry(ctx: Context, app: String, expUnixSec: Long, isTrial: Boolean): Boolean {
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
            val title = if (isTrial) ctx.getString(R.string.trial_expiry_notify_title)
            else ctx.getString(R.string.expiry_notify_title)
            val body = if (isTrial) ctx.getString(R.string.trial_expiry_notify_body, appCN)
            else ctx.getString(R.string.expiry_notify_body, appCN, date)
            val contentIntent = PendingIntent.getActivity(
                ctx, 0,
                // SINGLE_TOP 防通知点击叠栈（净屏审查 S6）
                Intent(ctx, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
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
        private const val WINDOW_TO_DAYS = 7L
        private const val TRIAL_WINDOW_HOURS = 36L
        const val PERIOD_HOURS = 24L
        const val WORK_NAME = "shiyin_expiry_reminder"
    }
}

/** 周期调度（幂等：已存在则保留，不重复入队） */
object ExpiryReminderScheduler {
    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<ExpiryReminderWorker>(ExpiryReminderWorker.PERIOD_HOURS, TimeUnit.HOURS)
            .build()
        WorkManager.getInstance(context.applicationContext)
            .enqueueUniquePeriodicWork(
                ExpiryReminderWorker.WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
    }
}

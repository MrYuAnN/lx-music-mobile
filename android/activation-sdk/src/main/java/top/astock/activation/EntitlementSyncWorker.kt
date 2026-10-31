/*
 * 净屏 - 权益周期巡检（2026-08-27 拍板）：冷启动（Application onCreate）与回首页
 * （HomeActivity onResume）之外的失效检查盲区 = 「进程长驻前台/后台、不再进出首页」。
 * WorkManager 每 6h 执行 refreshOnStart（打只读 /api/binding-check 校验绑定态并
 * 刷新权益，按三态模型分派处置）+ enforceExpiry（关闭全部过期/停权 App 的过滤意图），
 * 把常驻期间的失效滞后压缩到一个调度间隔。撤权不依赖任何推送通道——推送不可达是
 * 常态，业界通行做法为客户端定期拉取 + 本地时钟判定；强制力本身在 per-app 时钟比较
 * 与服务端 403 门禁，巡检只是收窄展示/停拦动作的滞后窗口。网络失败照常走离线宽限
 * 保留本地态；无网唤醒由冷启动/onResume 兜底。
 */
package top.astock.activation

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class EntitlementSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        runCatching { EntitlementManager.refreshOnStart(ctx) }
        runCatching { EntitlementManager.enforceExpiry(ctx) }
        // 首启免费试用重试兜底（2026-10-13 拍板触发点三之三）：进程常驻不回前台的
        // 设备由此补 claim——SDK 内部退避节流+Unactivated 前置，未到点空返回零请求
        runCatching { EntitlementManager.claimTrial(ctx) }
        // 单次失败不重试堆积：幂等动作，下个调度周期天然覆盖
        return Result.success()
    }

    companion object {
        const val PERIOD_HOURS = 6L
        const val WORK_NAME = "jingping_entitlement_sync"
    }
}

/** 周期调度（幂等：同名任务存在则更新 spec，不重复入队） */
object EntitlementSyncScheduler {
    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<EntitlementSyncWorker>(EntitlementSyncWorker.PERIOD_HOURS, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context.applicationContext)
            .enqueueUniquePeriodicWork(
                EntitlementSyncWorker.WORK_NAME,
                // UPDATE 而非 KEEP：WORK_NAME 不含包名故沿用旧名（改新名会让 UPDATE 摸不到
                // 旧任务、旧 spec 残留致 6h 巡检停摆）；UPDATE 覆盖旧 FQN spec，零成本兜底
                // 「存在装过旧包名的内测/调试机」场景（方案 v3 S2）
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
    }
}

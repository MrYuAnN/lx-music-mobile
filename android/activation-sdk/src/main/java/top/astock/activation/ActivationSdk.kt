/*
 * 净屏激活 SDK - 运行时配置单源（批次 4 自净屏 App 抽取，方案 §3.7）
 *
 * 宿主在 Application.onCreate 里 init() 一次注入四个部署参数（apiBase/productId/
 * deviceSalt/servicePubkeyHex）+ xClientVersion；可选 webBaseUrl/installReportEnabled。
 * 运行时注入（业界主流：Firebase/AppsFlyer 模式）而非 BuildConfig 硬编码——拷入方
 * 零 gradle 改动，只填配置即得激活/续费/恢复/绑定巡检/验签/活跃上报全链。
 *
 * deviceSalt 是设备指纹盐：换了盐 = 全部存量设备指纹失效（设备被视为新设备），
 * 必须与平台 products 注册表 salt_id 一致（接入 SOP 校验项）且创建后不可变。
 * 净屏值 "jingping-device-v1" 永不改（盐不变断言入宿主测试）。
 */
package top.astock.activation

import android.content.Context

/** 受管 app 条目（enforceExpiry 逐项检查的对象；宿主从自己的业务清单映射） */
data class ManagedApp(val app: String, val targetPackage: String)

object ActivationSdk {

    /** 平台 API 基址（如 https://api.a-stock.top；批次 3 统一域名） */
    @Volatile
    var apiBase: String = ""
        private set

    /** 产品键（X-Product 头，随所有平台端点请求上报；须与平台 products 注册表键一致） */
    @Volatile
    var productId: String = ""
        private set

    /** 设备指纹盐（Android ID 盐化哈希用；不可变，见类注释） */
    @Volatile
    var deviceSalt: String = ""
        private set

    /** Receipt 验签服务公钥（32 字节 hex = 部署实例 secrets/service.public；init 校验非空 64 位 hex） */
    @Volatile
    var servicePubkeyHex: String = ""
        private set

    /** 宿主版本名（X-Client-Version 头；服务端按它做 min_client 升级分流） */
    @Volatile
    var xClientVersion: String = ""
        private set

    /** 官网基址（可选；宿主 UI 跳转/静页链接用，SDK 逻辑不依赖） */
    @Volatile
    var webBaseUrl: String = ""
        private set

    /** install 活跃上报开关（v1.1 上收配套；默认开启，净屏沿用开启） */
    @Volatile
    var installReportEnabled: Boolean = true
        private set

    /** 受管 app 清单 provider（每次 enforceExpiry 现取，宿主清单可动态加载） */
    @Volatile
    var managedAppsProvider: () -> List<ManagedApp> = { emptyList() }
        private set

    /** 到期处置钩子（权益缺失/过期时挂起回调；null=宿主不做任何强制处置）。
     *  suspend：宿主处置常为挂起操作（如净屏关过滤），enforceExpiry 逐个顺序等待，
     *  与抽取前内联实现语义一致（三席审查后编译实证修正：非 suspend 签名调不动
     *  suspend 处置）。 */
    @Volatile
    var onAppNotEntitled: (suspend (Context, ManagedApp) -> Unit)? = null
        private set

    /**
     * 初始化（宿主 Application.onCreate 调一次；重复调用以最后一次为准）。
     * 未 init 即用 = apiBase 空串，所有网络请求打向无效地址静默失败（离线宽限兜底），
     * 不抛异常——宿主接线遗漏不崩溃，但必须自查（README 检查单）。
     */
    fun init(
        apiBase: String,
        productId: String,
        deviceSalt: String,
        servicePubkeyHex: String,
        xClientVersion: String,
        webBaseUrl: String = "",
        installReportEnabled: Boolean = true,
    ) {
        // 公钥 fail-fast（三席审查 I-1）：空/格式错即抛——receipt 验签是防伪底线，
        // 静默跳过=接入期配置残缺被掩盖到运行期（原常量恒非空，SDK 化后必须拦在 init）
        require(servicePubkeyHex.length == 64 && servicePubkeyHex.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }) {
            "servicePubkeyHex 必须为 64 位 hex（平台实例 secrets/service.public），当前=\"$servicePubkeyHex\""
        }
        this.apiBase = apiBase
        this.productId = productId
        this.deviceSalt = deviceSalt
        this.servicePubkeyHex = servicePubkeyHex
        this.xClientVersion = xClientVersion
        this.webBaseUrl = webBaseUrl
        this.installReportEnabled = installReportEnabled
    }

    /**
     * 注册到期处置（可选；净屏=按 uid 关过滤）。managedAppsProvider 每次现取
     * （宿主清单可运行时加载）；onAppNotEntitled 幂等要求由宿主保证
     * （SDK 不去重，每个过期 app 每轮巡检回调一次）。
     */
    fun registerExpiryHandler(
        managedAppsProvider: () -> List<ManagedApp>,
        onAppNotEntitled: suspend (Context, ManagedApp) -> Unit,
    ) {
        this.managedAppsProvider = managedAppsProvider
        this.onAppNotEntitled = onAppNotEntitled
    }
}

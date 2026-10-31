// 启动打点（F-1 §二.4，审查 I-A/I-B）：每条附 JS 段相对时间戳（模块加载即 t0，早于 init
// 动态 import，起点覆盖完整）+ 桥接 logcat——release Hermes 下 console.log 不进 logcat
// （build-speed 铁律），桥接走 console.warn（异常通道，`adb logcat -s ReactNativeJS` 可抓
// `[BOOT]` 行）；dev 用 log 免 LogBox 启动期噪声（F-1 审查 S-a 双通道）
const t0 = Date.now()
const logs: string[] = []

export const bootLog = (...msgs: any[]) => {
  const line = `[+${Date.now() - t0}ms] ${msgs.map(m => typeof m == 'string' ? m : JSON.stringify(m)).join(' ')}`
  logs.push(line)
  const log = __DEV__ ? console.log : console.warn
  log('[BOOT]', line)
}

export const getBootLog = () => {
  return logs.join('\n')
}

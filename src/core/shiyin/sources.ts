// 音源中文名表（A1 架构批自 activation.ts 迁出为纯模块）：gate.ts 纯工厂零 RN import
// 仍需消费本表（guideSourceEntitlement 文案 name 参数），本文件零依赖 node:test 可加载。
// activation.ts re-export 兼容既有 import 面（client/MyKeys/Purchase 不改行）。
// ADR-0001 背景「APP_CN 五键表」单源此处，新增音源先补此表。
export const APP_CN: Record<string, string> = {
  shiyin: '全部音源',
  tx: 'QQ音乐',
  wy: '网易云音乐',
  kg: '酷狗音乐',
  kw: '酷我音乐',
}

// flushBatch.ts 使用统计批量常量单源（T3 件7 自 flusher.ts 抽取——flusher 依赖
// RN 无法进 node:test，skuParse.ts 平移同款；纯模块供 flushBatch.test.mts 对拍
// flush-contract.json）。零 import。
export const FLUSH_BATCH = 50 // 服务端契约镜像（usageMaxBatch；平台 internal/api/events.go 对拍，T3 收编批笔⑤）

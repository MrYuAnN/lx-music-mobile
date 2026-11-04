// flushBatch 单测（T3 件7）：客户端批量常量 ↔ flush-contract.json（同目录测试区，
// fs 直读不经 import——S2 不进 metro 依赖图）+ tracker.ts QUEUE_FLUSH_THRESHOLD
// 静态扫描（RN 依赖模块无法直测，源码字面量锁）。运行：node --test src/core/stats/flushBatch.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLUSH_BATCH } from './flushBatch.ts'

const here = `${dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')}/`
const golden = JSON.parse(readFileSync(`${here}flush-contract.json`, 'utf8'))

test('FLUSH_BATCH 契约镜像对拍 flush-contract.json', () => {
  assert.equal(FLUSH_BATCH, golden.sample.flush_batch)
})

test('QUEUE_FLUSH_THRESHOLD 静态扫描与 golden 记录一致（触发阈值非契约锚，仅记录）', () => {
  const src = readFileSync(`${here}tracker.ts`, 'utf8')
  const m = src.match(/QUEUE_FLUSH_THRESHOLD = (\d+)/)
  assert.ok(m, 'tracker.ts QUEUE_FLUSH_THRESHOLD 声明缺失（正则或常量改名须同步）')
  assert.equal(Number(m[1]), golden.sample.queue_flush_threshold)
})

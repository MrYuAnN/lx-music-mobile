import { forwardRef, useImperativeHandle, useRef, type JSX } from 'react'

import InputSheet, { type InputSheetType } from './InputSheet'
import { useI18n } from '@/lang'
import { parseSonglistLink } from '@/utils/parseSonglistLink'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { toast } from '@/utils/tools'

// 导入歌单弹层（歌单链接导入批，方案 doc/plans/playlist-link-import.md §三.2）：
// InputSheet 链接模式——不传 maxLength（30 为歌单名限制，URL 勿照抄 CreateListDialog）；
// 无同名查重属有意差异（链接目标由源平台决定，本地名单不参与判定）。
// 解析失败 toast 不关层；成功 hide 后跳在线歌单详情页预览，收藏（活同步）/克隆本地
// （可编辑快照）由用户在详情页自主定（方案 grilling #3）。
//
// 防重入（方案 R5）：解析含短链网络展开，进行中忽略重复提交——确认钮 onPressIn 与 IME
// 「完成」键双入口均被 doing ref 拦截；无禁用视觉态（不扩共享 InputSheet，最小改动拍板）。
//
// 取消竞态（方案 v3 §三.2，代码审查 I1 贯通实现）双保险：
// ① session token——每次 show() 递增，晚到结果比对会话号，关层重开（标志被 show 重置）后
//   旧结果不再生效（不关新层不跳屏）；
// ② AbortSignal——onHide 置作废标志并 abort 在途 fetch，请求即时中止而非悬挂至超时。
// 失败 toast 前同样查作废/会话：用户已取消则不再误弹「未识别到链接」。
//
// 硬约束（方案 §三.2）：跳详情页的 name 必须传空串——详情页头部回填为
// `info.name || 拉取名`（SonglistDetail/MusicList.tsx），非空 props 名会永久遮挡
// 拉取到的真实歌单名。
export interface ImportListDialogType {
  show: () => void
}

const ImportListDialog = (_: unknown, ref: React.Ref<ImportListDialogType>) => {
  const t = useI18n()
  const sheetRef = useRef<InputSheetType>(null)
  const doingRef = useRef(false)
  const discardedRef = useRef(false)
  const sessionRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useImperativeHandle(ref, () => ({
    show() {
      sessionRef.current += 1
      discardedRef.current = false
      sheetRef.current?.show()
    },
  }))

  const handleConfirm = async(linkText: string) => {
    if (doingRef.current) return
    doingRef.current = true
    const session = sessionRef.current
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const parsed = await parseSonglistLink(linkText, controller.signal)
      // 作废（已关层）或已开新会话：静默丢弃晚到结果，不 toast 不跳屏
      if (discardedRef.current || session != sessionRef.current) return
      if (!parsed) {
        toast(global.i18n.t('list_import_link_invalid'))
        return
      }
      const componentId = commonState.componentIds.home
      if (!componentId) return
      sheetRef.current?.hide()
      navigations.pushSonglistDetailScreen(componentId, {
        id: parsed.id,
        source: parsed.source,
        name: '',
        author: '',
      })
    } finally {
      doingRef.current = false
      abortRef.current = null
    }
  }

  return (
    <InputSheet
      ref={sheetRef}
      title={t('list_import_link_title')}
      placeholder={t('list_import_link_placeholder')}
      onConfirm={handleConfirm}
      onHide={() => {
        discardedRef.current = true
        abortRef.current?.abort()
      }}
    />
  )
}

export default forwardRef(ImportListDialog) as (p: { ref?: React.Ref<ImportListDialogType> }) => JSX.Element | null

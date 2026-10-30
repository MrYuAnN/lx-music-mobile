import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'

import ActionSheet, { type ActionSheetType, type ActionSheetItem } from '@/components/common/ActionSheet'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import { useI18n } from '@/lang'
import { setTempList } from '@/core/list'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { playList } from '@/core/player/player'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import { isAppDownloadedPath, removeLocalMusics } from '@/core/localMusic'
import { readMetadata, writeMetadata, writePic } from '@/utils/localMediaMetadata'
import { downloadFile, temporaryDirectoryPath, unlink } from '@/utils/fs'
import { confirmDialog, toast } from '@/utils/tools'

// 本地歌曲行菜单（问题 3 §2.0：播放/下一首播放/收藏），本地音乐主页与聚合二级屏共用
export interface LocalMusicMenuType {
  /** show(item, list)：list 为当前视图歌曲集（play 时注入临时列表） */
  show: (musicInfo: SY.Music.MusicInfoLocal, list: SY.Music.MusicInfoLocal[]) => void
}

export default forwardRef<LocalMusicMenuType>((_, ref) => {
  const t = useI18n()
  const menuRef = useRef<ActionSheetType>(null)
  const listMusicAddRef = useRef<MusicAddModalType>(null)
  const selectedRef = useRef<{ item: SY.Music.MusicInfoLocal, list: SY.Music.MusicInfoLocal[] }>({ item: null as unknown as SY.Music.MusicInfoLocal, list: [] })

  useImperativeHandle(ref, () => ({
    show(musicInfo, list) {
      selectedRef.current = { item: musicInfo, list }
      menuRef.current?.show()
    },
  }))

  const menus: ActionSheetItem[] = [
    { action: 'play', label: t('play'), icon: 'play' },
    { action: 'playLater', label: t('play_later'), icon: 'play-later' },
    { action: 'add', label: t('add_to'), icon: 'add-to' },
    // 写入标签（2026-10-30 元数据绑定定稿·外部导入分层方案）：自动匹配仍存应用层（可逆零风险），
    // 此处为显式动作——把已匹配的封面/歌手/专辑嵌入文件本体，只补空不覆盖（防错配污染原件）
    { action: 'writeTag', label: t('local_music_write_tag'), icon: 'edit-metadata' },
    // 删除（2026-10-29 ③-3 定稿 I-A）：主页+二级屏共用自动生效。确认分级随条目判定——
    // 本 App 下载产物弱确认直删（可重新下载），外部文件强确认（文件不可恢复）
    { action: 'delete', label: t('local_music_delete'), icon: 'trash' },
  ]

  const handleMenuPress = useCallback(({ action }: ActionSheetItem) => {
    const { item, list } = selectedRef.current
    switch (action) {
      case 'play': {
        const index = list.findIndex(m => m.id == item.id)
        if (index < 0) break
        // 本地歌与在线歌共用临时列表播放链（播放器按 source 分流取 URL）
        void setTempList(storageDataPrefix.TEMP_LIST_LOCAL, list).then(() => {
          void playList(LIST_IDS.TEMP, index)
        })
        break
      }
      case 'playLater':
        // 下载曲按原曲在线身份入队（2026-10-29 题3 定稿：下载是属性非身份，歌单/稍后播放存歌不存文件）
        addTempPlayList([{ listId: '', musicInfo: item.meta.onlineInfo ?? item }])
        break
      case 'add':
        listMusicAddRef.current?.show({ musicInfo: item.meta.onlineInfo ?? item, listId: '', isMove: false })
        break
      case 'writeTag': {
        // 写入标签（2026-10-30 元数据绑定定稿·分层方案）：已匹配信息嵌入文件本体。
        // 只补空不覆盖：先读现有标签，非空字段保留（防错配污染用户原件）；封面写
        // 已匹配图（旁车 file:// 直用，http 先落临时再嵌）。任一环节失败即 toast 指明
        void (async() => {
          try {
            const filePath = item.meta.filePath
            let existing: { name?: string, singer?: string, albumName?: string } | null = null
            try {
              existing = await readMetadata(filePath)
            } catch { /* 无标签/不支持的文件按全空处理，全部写入匹配值 */ }
            await writeMetadata(filePath, {
              name: existing?.name || item.name || '',
              singer: existing?.singer || item.singer || '',
              albumName: existing?.albumName || item.meta.albumName || '',
            }, false)
            const pic = item.meta.picUrl
            if (pic?.startsWith('file://')) {
              await writePic(filePath, pic.slice('file://'.length))
            } else if (pic?.startsWith('/')) {
              await writePic(filePath, pic)
            } else if (pic) {
              // 远程匹配封面：先落临时目录再嵌
              const tmp = `${temporaryDirectoryPath}/write-tag-cover-tmp`
              const res = await downloadFile(pic, tmp, { connectionTimeout: 15000, readTimeout: 15000 }).promise
              if (res.statusCode >= 400) throw new Error(`cover HTTP ${res.statusCode}`)
              await writePic(filePath, tmp)
              await unlink(tmp).catch(() => {})
            }
            toast(t('local_music_write_tag_success'))
          } catch (err) {
            console.warn('[writeTag] failed:', (err as Error)?.message)
            toast(t('local_music_write_tag_failed'))
          }
        })()
        break
      }
      case 'delete': {
        const downloaded = isAppDownloadedPath(item.meta.filePath)
        void (async() => {
          // 其他音乐 tab：单删强确认（文件不可恢复，审查 I-C 对标口径）；已下载直删+toast
          if (!downloaded && !await confirmDialog({
            title: t('local_music_delete'),
            message: t('local_music_delete_tip_other'),
          })) return
          const { failed } = await removeLocalMusics([item.id])
          toast(global.i18n.t(failed ? 'local_music_delete_failed' : 'download_removed'))
        })()
        break
      }
    }
  }, [t])

  return (
    <>
      <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} />
      <ListMusicAdd ref={listMusicAddRef} />
    </>
  )
})

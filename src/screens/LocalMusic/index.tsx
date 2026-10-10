import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, FlatList, Linking, NativeModules, Platform, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import SearchBar from '@/components/common/SearchBar'
import CategoryChips from '@/components/common/CategoryChips'
import DotsVertical from '@/components/common/DotsVertical'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import LocalMusicMenu, { type LocalMusicMenuType } from './LocalMusicMenu'
import { FolderSectionList, AlbumGrid, ArtistList, splitSingers, type MusicGroup, type GroupViewActions } from './GroupViews'
import { storageDataPrefix, LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { scanLocalMusic, useLocalMusicList, useLocalMusicScanning, useLocalMusicScanProgress, toMusicInfoLocal } from '@/core/localMusic'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useLikedSet, useLikeToggle } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'
import { pushLocalMusicGroupScreen } from '@/navigation/navigation'
import { createStyle } from '@/utils/tools'
import { ensureStoragePermission, isStorageGranted } from '@/utils/permissions'
import { scaleSizeH } from '@/utils/pixelRatio'

type ViewId = 'all' | 'folder' | 'album' | 'artist'

// 本地音乐（multifix 问题 3）：混合判定授权流（老用户无感 / 未授权走 MANAGE 开关页引导）
// + 纯净搜索框 + 页头 ⋮ 菜单（重新扫描）+ 四视图 chips（全部/文件夹/专辑/歌手）
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const theme = useTheme()
  const list = useLocalMusicList()
  const scanning = useLocalMusicScanning()
  const progress = useLocalMusicScanProgress()
  const likedSet = useLikedSet()
  const toggleLike = useLikeToggle()
  const menuRef = useRef<LocalMusicMenuType>(null)
  const [view, setView] = useState<ViewId>('all')
  const [keyword, setKeyword] = useState('')
  const [permissionDenied, setPermissionDenied] = useState(false)
  // 未授权首态：整页授权引导（隐藏搜索框/chips/页头⋮）；「暂不授权」后为普通空列表态
  const [showAuthGuide, setShowAuthGuide] = useState(false)

  const handleScan = useCallback(() => {
    // 重扫路径同步回写 denied 态（授权/撤销授权后空态随最新结果更新）
    void scanLocalMusic().then(({ failedDirs }) => {
      setPermissionDenied(failedDirs.length > 0)
    })
  }, [])

  const startWatchAuth = useCallback(() => {
    setShowAuthGuide(true)
  }, [])

  // 授权引导展示期间监听回前台：重查授权态，仅从「未授权→已授权」变化时才解除引导并重扫
  useEffect(() => {
    if (!showAuthGuide) return
    const handleChange = (state: string) => {
      if (state != 'active') return
      void isStorageGranted().then(granted => {
        if (!granted) return
        setShowAuthGuide(false)
        handleScan()
      })
    }
    const subscription = AppState.addEventListener('change', handleChange)
    return () => {
      subscription.remove()
    }
  }, [showAuthGuide, handleScan])

  useEffect(() => {
    // 首次进页：API<30 运行时对话框（ensure 内），拒绝也继续扫描——failedDirs 回写 denied 空态（含去授权入口）；
    // API30+ 未授权 → 整页引导（不自动弹窗）
    void ensureStoragePermission().then(granted => {
      if (granted) {
        handleScan()
      } else if (Platform.OS == 'android' && Number(Platform.Version) >= 30) {
        startWatchAuth()
      } else {
        handleScan()
      }
    })
  }, [handleScan, startWatchAuth])

  // LocalMusicItem → MusicInfoLocal 一次转换（统一行 memo 依赖稳定引用）
  const musicInfos = useMemo(() => list.map(toMusicInfoLocal), [list])

  const filtered = useMemo(() => {
    if (!keyword) return musicInfos
    const kw = keyword.toLowerCase()
    return musicInfos.filter(item => item.name.toLowerCase().includes(kw) || item.singer.toLowerCase().includes(kw))
  }, [musicInfos, keyword])

  const folders = useMemo(() => {
    const map = new Map<string, LX.Music.MusicInfoLocal[]>()
    for (const item of filtered) {
      const dir = item.meta.filePath.replace(/\/[^/]+$/, '') || '/'
      const bucket = map.get(dir)
      if (bucket) bucket.push(item)
      else map.set(dir, [item])
    }
    return [...map.entries()].map(([dir, items]) => ({
      key: dir,
      name: dir.split('/').pop() ?? dir,
      data: items,
    }))
  }, [filtered])

  // 「未知专辑」桶名经 global.i18n.t 取名，langId 入依赖使语言切换后重建
  const langId = useSettingValue('common.langId')
  const albums = useMemo(() => {
    const map = new Map<string, MusicGroup>()
    for (const item of filtered) {
      const name = item.meta.albumName || global.i18n.t('local_music_unknown_album')
      const bucket = map.get(name)
      if (bucket) bucket.list.push(item)
      else map.set(name, { name, singer: item.singer, list: [item] })
    }
    return [...map.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- langId 入依赖：语言切换后「未知专辑」桶名重建
  }, [filtered, langId])

  const artists = useMemo(() => {
    const map = new Map<string, MusicGroup>()
    for (const item of filtered) {
      for (const name of splitSingers(item.singer)) {
        const bucket = map.get(name)
        if (bucket) bucket.list.push(item)
        else map.set(name, { name, list: [item] })
      }
    }
    return [...map.values()]
  }, [filtered])

  const scanningLabel = scanning && progress.total > 0
    ? `${t('local_music_scanning')} ${progress.done}/${progress.total}`
    : t('local_music_scanning')

  const handleRescan = useCallback(() => {
    // ⋮ 重新扫描：API30+ 未授权再进引导流；API<30 拒绝仍扫描（denied 空态回收）；已授权直接扫
    void ensureStoragePermission().then(granted => {
      if (granted) {
        handleScan()
      } else if (Platform.OS == 'android' && Number(Platform.Version) >= 30) {
        startWatchAuth()
      } else {
        handleScan()
      }
    })
  }, [handleScan, startWatchAuth])

  const handleGoSettings = useCallback(() => {
    // 直跳本应用「所有文件访问权限」开关页（图 2 流程，原生 startActivity 带 package），
    // 模块缺失/无此 action（含 API<30）时兜底应用信息页
    const open = NativeModules.DownloadSupport?.openAllFilesAccessSettings?.()
    void (open ?? Promise.reject(new Error('DownloadSupport unavailable'))).catch(async() => {
      return Linking.openSettings().catch(() => {})
    })
  }, [])

  const handleSongPress = useCallback((item: LX.Music.MusicInfoLocal, list: LX.Music.MusicInfoLocal[]) => {
    // 本地歌与在线歌共用临时列表播放链（播放器按 source 分流取 URL）
    void setTempList(storageDataPrefix.TEMP_LIST_LOCAL, list).then(() => {
      const index = list.findIndex(m => m.id == item.id)
      if (index > -1) void playList(LIST_IDS.TEMP, index)
    })
  }, [])

  // keyword 重过滤后行 item 引用不变、memo 跳过重渲染，行内回调会持有旧 filtered——
  // 列表经 ref 取当前值，保证播放/菜单注入的队列与屏幕显示一致（架构师 I6 修复）
  const filteredRef = useRef(filtered)
  filteredRef.current = filtered

  const groupActions: GroupViewActions = useMemo(() => ({
    isLiked: id => likedSet.has(id),
    onLikePress: toggleLike,
    onSongPress: handleSongPress,
    onShowMenu: (item, viewList) => { menuRef.current?.show(item as LX.Music.MusicInfoLocal, viewList) },
  }), [likedSet, toggleLike, handleSongPress])

  const handleGroupPress = useCallback((type: 'album' | 'artist', group: MusicGroup) => {
    pushLocalMusicGroupScreen(componentId, { type, value: group.name, list: group.list })
  }, [componentId])

  const chips = useMemo(() => {
    return (['all', 'folder', 'album', 'artist'] as const).map(id => ({ id, label: t(`local_music_view_${id}`) }))
  }, [t])

  const headerRight = showAuthGuide
    ? null
    : scanning
      ? (
          <Text style={{ ...styles.scanLabel, color: theme['c-font-label'] }} numberOfLines={1}>
            {scanningLabel}
          </Text>
        )
      : (
          <DorpDownMenu menus={[{ label: t('local_music_rescan'), action: 'rescan' }]} onPress={handleRescan}>
            <View style={styles.headerDots}>
              <DotsVertical color={theme['c-font-label']} />
            </View>
          </DorpDownMenu>
        )

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('local_music')} right={headerRight} />
      {
        showAuthGuide
          ? <AuthGuide onGoSettings={handleGoSettings} onLater={() => { setShowAuthGuide(false) }} />
          : (
              <>
                <View style={styles.searchBar}>
                  <SearchBar
                    placeholder={t('local_music_search_placeholder')}
                    value={keyword}
                    onChangeText={setKeyword}
                    onSubmit={() => {}}
                    onClear={() => { setKeyword('') }}
                    tone="plain"
                  />
                </View>
                <View style={styles.chips}>
                  <CategoryChips items={chips} activeId={view} onChange={id => { setView(id as ViewId) }} />
                </View>
                {
                  view == 'all'
                    ? (
                        <FlatList
                          style={styles.list}
                          data={filtered}
                          keyExtractor={item => item.id}
                          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                          renderItem={({ item, index }) => (
                            <ListItem
                              item={item}
                              index={index}
                              rowInfo={{ rowNum: undefined, rowWidth: '100%' }}
                              selectedList={[]}
                              showIndex={false}
                              showCover
                              showSource={false}
                              showInterval={false}
                              showSublineInterval
                              isShowAlbumName={false}
                              isLiked={likedSet.has(item.id)}
                              onLikePress={toggleLike}
                              onPress={(_, pressIndex) => { handleSongPress(filteredRef.current[pressIndex], filteredRef.current) }}
                              onLongPress={pressedItem => { menuRef.current?.show(pressedItem as LX.Music.MusicInfoLocal, filteredRef.current) }}
                              onShowMenu={itemInfo => { menuRef.current?.show(itemInfo as LX.Music.MusicInfoLocal, filteredRef.current) }}
                            />
                          )}
                          ListEmptyComponent={
                            <EmptyList
                              denied={permissionDenied}
                              scanning={scanning}
                              scanningLabel={scanningLabel}
                              onOpenSettings={handleGoSettings}
                            />
                          }
                        />
                      )
                    : view == 'folder'
                      ? <FolderSectionList folders={folders} actions={groupActions} />
                      : view == 'album'
                        ? <AlbumGrid albums={albums} onGroupPress={group => { handleGroupPress('album', group) }} />
                        : <ArtistList artists={artists} onGroupPress={group => { handleGroupPress('artist', group) }} />
                }
              </>
            )
      }
      <LocalMusicMenu ref={menuRef} />
      <PlayerBarPlaceholder />
    </PageContent>
  )
}

// 授权引导首态（对齐 MusicFree）：大圆形光盘图标 + 标题 + 说明 + 宽胶囊主按钮 + 次级文字
const AuthGuide = ({ onGoSettings, onLater }: { onGoSettings: () => void, onLater: () => void }) => {
  const t = useI18n()
  const theme = useTheme()
  return (
    <View style={styles.guide}>
      <View style={{ ...styles.guideIcon, backgroundColor: theme['c-border-background'] }}>
        <IconDisc />
      </View>
      <Text style={styles.guideTitle} size={17}>{t('local_music_auth_title')}</Text>
      <Text style={styles.guideDesc} size={13} color={theme['c-font-label']}>{t('local_music_auth_desc')}</Text>
      <TouchableOpacity
        style={{ ...styles.guideBtn, backgroundColor: theme['c-primary'] }}
        activeOpacity={0.7}
        onPress={onGoSettings}
      >
        <Text size={14} color={theme['c-on-primary']}>{t('local_music_auth_go_settings')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.guideLater} activeOpacity={0.7} onPress={onLater}>
        <Text size={14} color={theme['c-font-label']}>{t('local_music_auth_later')}</Text>
      </TouchableOpacity>
    </View>
  )
}

// 光盘线稿图标（View 绘制圆环+中孔，不依赖字体码点）
const IconDisc = () => {
  const theme = useTheme()
  const color = theme.isDark ? '#D8D8DC' : '#3A3A3C'
  return (
    <View style={{ ...styles.disc, borderColor: color }}>
      <View style={{ ...styles.discHole, borderColor: color }} />
    </View>
  )
}

const EmptyList = ({ denied, scanning, scanningLabel, onOpenSettings }: {
  denied: boolean
  scanning: boolean
  scanningLabel: string
  onOpenSettings: () => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  return (
    <View style={styles.empty}>
      {
        scanning
          ? <Text size={13} color={theme['c-font-label']}>{scanningLabel}</Text>
          : (
              <>
                <Text style={styles.emptyHint} size={13} color={theme['c-font-label']}>{t('local_music_empty_hint')}</Text>
                {
                  denied
                    ? (
                        // API<30 拒绝权限后的恢复入口（重扫同样可再触发对话框，永久拒绝时此按钮兜底）
                        <>
                          <Text size={13} color={theme['c-font-label']}>{t('local_music_permission')}</Text>
                          <TouchableOpacity
                            style={{ ...styles.emptyBtn, backgroundColor: theme['c-primary'] }}
                            activeOpacity={0.7}
                            onPress={onOpenSettings}
                          >
                            <Text size={13} color={theme['c-on-primary']}>{t('local_music_go_settings')}</Text>
                          </TouchableOpacity>
                        </>
                      )
                    : null
                }
              </>
            )
      }
    </View>
  )
}

const styles = createStyle({
  searchBar: {
    marginHorizontal: 14,
    marginBottom: 4,
  },
  chips: {
    paddingTop: 12,
    paddingBottom: 2,
  },
  list: {
    flex: 1,
  },
  headerDots: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLabel: {
    fontSize: 13,
    paddingRight: 12,
  },
  empty: {
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 4,
  },
  guide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  guideIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleSizeH(56),
  },
  disc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discHole: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.7,
  },
  guideTitle: {
    marginTop: 26,
  },
  guideDesc: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  guideBtn: {
    alignSelf: 'stretch',
    height: scaleSizeH(44),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  guideLater: {
    padding: 10,
    marginTop: 8,
  },
})

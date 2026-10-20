import { memo, useCallback, useEffect, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import { getExternalStoragePaths, stat } from '@/utils/fs'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import NewFolderModal, { type NewFolderType } from './NewFolderModal'
import OpenStorageModal, { type OpenDirModalType } from './OpenStorageModal'
import type { PathItem } from './ListItem'
import { SPACING } from '@/config/spacing'

export default memo(({
  title,
  path,
  onRefreshDir,
  onOpenDir,
}: {
  title: string
  path: string
  onRefreshDir: (dir: string) => Promise<PathItem[]>
  onOpenDir: (dir: string) => Promise<PathItem[]>
}) => {
  const theme = useTheme()
  const newFolderTypeRef = useRef<NewFolderType>(null)
  const openDirModalTypeRef = useRef<OpenDirModalType>(null)
  const storagePathsRef = useRef<string[]>([])

  const checkExternalStoragePath = useCallback(() => {
    storagePathsRef.current = []
    void getExternalStoragePaths().then(async(storagePaths) => {
      for (const path of storagePaths) {
        try {
          if (!(await stat(path)).canRead) continue
        } catch { continue }
        storagePathsRef.current.push(path)
      }
    })
  }, [])
  useEffect(() => {
    checkExternalStoragePath()
  }, [checkExternalStoragePath])

  const refresh = () => {
    void onRefreshDir(path)
    checkExternalStoragePath()
  }

  const openStorage = () => {
    openDirModalTypeRef.current?.show(storagePathsRef.current)
  }

  const handleShowNewFolderModal = () => {
    newFolderTypeRef.current?.show(path)
  }

  return (
    <>
      <View style={styles.header} onStartShouldSetResponder={() => true}>
        <View style={styles.titleContent}>
          <Text color={theme['c-primary-font']} numberOfLines={1}>{title}</Text>
          <Text style={styles.subTitle} color={theme['c-primary-font']} size={13} numberOfLines={1}>{path}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={openStorage}>
            <Icon name="sd-card" color={theme['c-primary-font']} size={ICON_SIZE.nav} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShowNewFolderModal}>
            <Icon name="add_folder" color={theme['c-primary-font']} size={ICON_SIZE.nav} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={refresh}>
            <Icon name="available_updates" color={theme['c-primary-font']} size={ICON_SIZE.nav} />
          </TouchableOpacity>
        </View>
      </View>
      <OpenStorageModal ref={openDirModalTypeRef} onOpenDir={onOpenDir} />
      <NewFolderModal ref={newFolderTypeRef} onRefreshDir={onRefreshDir} />
    </>
  )
})

const styles = createStyle({
  header: {
    flexGrow: 0,
    flexShrink: 0,
    height: scaleSizeH(50),
    flexDirection: 'row',
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    alignItems: 'center',
    // sheet 化（弹窗体系统一方案批2#9）：状态栏避让移除（弹层内无需要）、底色移除（透出 SheetBase 玻璃/回退实色底）
    elevation: 2,
    zIndex: 2,
    // borderBottomWidth: BorderWidths.normal,
  },
  titleContent: {
    flexGrow: 1,
    flexShrink: 1,
    // height: 57,
    // paddingRight: 5,
    // paddingBottom: 10,
  },
  // title: {
  //   paddingTop: 10,
  // },
  subTitle: {
    paddingTop: 1,
  },
  actions: {
    flexDirection: 'row',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actionBtn: {
    paddingTop: SPACING.s8,
    paddingBottom: SPACING.s8,
    paddingLeft: SPACING.s6,
    paddingRight: SPACING.s6,
    marginLeft: SPACING.s10,
  },
  newFolderContent: {
    flexShrink: 1,
    flexDirection: 'column',
  },
  newFolderTitle: {
    marginBottom: SPACING.s6,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 240,
    borderRadius: 4,
    paddingTop: SPACING.s2,
    paddingBottom: SPACING.s2,
  },
})


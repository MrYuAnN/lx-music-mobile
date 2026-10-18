import { forwardRef, useImperativeHandle, useRef, useState, type JSX } from 'react'
import { TouchableOpacity, View } from 'react-native'

import InputSheet, { type InputSheetType } from './InputSheet'
import Text from './Text'
import { Icon } from './Icon'
import Image from './Image'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createList } from '@/core/list'
import listState from '@/store/list/state'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { pickCoverImage, saveCustomCover } from '@/utils/playlistCoverEdit'
import { ICON_SIZE } from '@/config/constant'

// 新建歌单面板（歌单封面机制批②，方案 §0 拍板 #4）：名字+可选封面，选了即 picCustom
// 冻结自动轨。封面仅预览不落盘，确认创建时才 saveCustomCover（取消编辑不落库）；
// 新建实体 id 由本组件预生成（封面文件名依赖 listId，createList 不返回 id）。
// 仅提交键触发创建（不复用 CreateUserList 的 onBlur 提交行内形态——取消语义冲突，AM-6 拍板延续）。
export interface CreateListDialogType {
  show: () => void
}

const CreateListDialog = (_: unknown, ref: React.Ref<CreateListDialogType>) => {
  const t = useI18n()
  const theme = useTheme()
  const sheetRef = useRef<InputSheetType>(null)
  // picker 临时 uri，'' = 未选
  const [tempCoverUri, setTempCoverUri] = useState('')

  useImperativeHandle(ref, () => ({
    show() {
      setTempCoverUri('')
      sheetRef.current?.show()
    },
  }))

  const handlePickCover = () => {
    void pickCoverImage().then(uri => {
      if (uri) setTempCoverUri(uri)
    }).catch(() => {
      toast(t('list_cover_fail'))
    })
  }

  const handleConfirm = async(name: string) => {
    if (listState.userList.some(l => l.name == name) && !(await confirmDialog({
      message: global.i18n.t('list_duplicate_tip'),
    }))) return
    sheetRef.current?.hide()
    // 新歌单置顶插入（对齐 AM 最近添加在顶部惯例）；实体构造收口到 core 的 createList。
    // 选了封面：预生成 id 落盘封面再创建；封面落盘失败降级无封面创建（不挡建单）
    if (tempCoverUri) {
      const id = `userlist_${Date.now()}`
      try {
        const pic = await saveCustomCover(id, tempCoverUri)
        await createList({ id, name, pic, picCustom: true, position: 0 })
      } catch {
        toast(t('list_cover_fail'))
        await createList({ id, name, position: 0 })
      }
      return
    }
    void createList({ name, position: 0 })
  }

  return (
    <InputSheet
      ref={sheetRef}
      title={t('list_create')}
      placeholder={t('list_create_input_placeholder')}
      maxLength={30}
      onConfirm={handleConfirm}
    >
      <TouchableOpacity style={styles.coverRow} activeOpacity={0.6} onPress={handlePickCover}>
        {
          tempCoverUri
            ? <Image url={tempCoverUri} style={styles.cover} />
            : (
                <View style={{ ...styles.cover, ...styles.coverEmpty, borderColor: theme['c-border-background'] }}>
                  <Icon name="plus" size={ICON_SIZE.control} color={theme['c-font-label']} />
                </View>
              )
        }
        <Text size={13} color={theme['c-font-label']}>{t('list_select_cover')}</Text>
      </TouchableOpacity>
    </InputSheet>
  )
}

export default forwardRef(CreateListDialog) as (p: { ref?: React.Ref<CreateListDialogType> }) => JSX.Element | null

const styles = createStyle({
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cover: {
    width: 84,
    height: 84,
    borderRadius: 8,
  },
  coverEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Input, { type InputType } from '@/components/common/Input'
import { useI18n } from '@/lang'
import { updateUserList } from '@/core/list'
import { setLoveCover } from '@/core/loveCover'
import { setDefaultCover } from '@/core/defaultCover'
import { queueCoverGen } from '@/utils/playlistCoverGen'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import settingState from '@/store/setting/state'
import listState from '@/store/list/state'
import { pickCoverImage, saveCustomCover, cleanCustomCovers } from '@/utils/playlistCoverEdit'
import { LIST_IDS, ICON_SIZE } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 歌单编辑面板（歌单封面机制批②，方案 §2.2-2 四形态；原「重命名」单字段升级）：
// user=自建（名字+封面+移除）/ collect=收藏（仅名字——封面属源站语义，菜单文案保留
// 「重命名」）/ love=我喜欢（仅封面+移除，走 lovePic setting 双键——updateList 对 LOVE
// 拦截不可用；移除回自动轨重生成，2026-10-23 纳入自动轨批）。封面先选后落（取消编辑不落库）；
// 写前按 id 重读最新条目（ensureListPic 竞态防护先例，防面板打开期间的并发编辑被 stale
// 快照回滚）。showCreate 死接口已删除（零调用方，新建入口唯一为 CreateListDialog）
interface NameInputType {
  setName: (text: string) => void
  getText: () => string
  focus: () => void
}
const NameInput = forwardRef<NameInputType, {}>((props, ref) => {
  const theme = useTheme()
  const [text, setText] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const inputRef = useRef<InputType>(null)

  useImperativeHandle(ref, () => ({
    getText() {
      return text.trim()
    },
    setName(text) {
      setText(text)
      setPlaceholder(text || global.i18n.t('list_create_input_placeholder'))
    },
    focus() {
      inputRef.current?.focus()
    },
  }))

  return (
    <Input
      ref={inputRef}
      placeholder={placeholder}
      value={text}
      onChangeText={setText}
      style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
    />
  )
})


export interface ListNameEditType {
  // 自建/收藏编辑：按 source 内部分流形态
  show: (listInfo: SY.List.UserListInfo) => void
  // 我喜欢封面编辑
  showLove: () => void
  // 默认歌单封面编辑（2026-10-18 拍板纳入封面机制）
  showDefault: () => void
}

type Mode = 'user' | 'collect' | 'love' | 'default'

export default forwardRef<ListNameEditType, {}>((props, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const alertRef = useRef<ConfirmAlertType>(null)
  const nameInputRef = useRef<NameInputType>(null)
  const selectedListInfo = useRef<SY.List.UserListInfo | null>(null)
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<Mode>('user')
  // 选图临时 uri（仅预览，提交才落盘）
  const tempCoverRef = useRef('')
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  // 本次会话内移除标记（提交时落 pic:''+picCustom:false / lovePic:null）
  const [coverRemoved, setCoverRemoved] = useState(false)

  const handleShow = (nextMode: Mode, initialCover: string | null, initialName: string) => {
    setMode(nextMode)
    setCoverPreview(initialCover)
    tempCoverRef.current = ''
    setCoverRemoved(false)
    requestAnimationFrame(() => {
      // love/default 形态无名字输入（三席审查 S-11：default 随形态集合一并纳入特判）
      if (nextMode == 'love' || nextMode == 'default') return
      nameInputRef.current?.setName(initialName)
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 300)
    })
    // 首次调用时 ConfirmAlert 未挂载（visible=false），先挂载下一帧再弹（原实现两段模式）
    if (visible) {
      alertRef.current?.setVisible(true)
    } else {
      setVisible(true)
      requestAnimationFrame(() => {
        alertRef.current?.setVisible(true)
      })
    }
  }

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      selectedListInfo.current = listInfo
      handleShow(listInfo.source ? 'collect' : 'user', listInfo.pic ?? null, listInfo.name ?? '')
    },
    showLove() {
      selectedListInfo.current = null
      handleShow('love', settingState.setting['list.lovePic'], '')
    },
    showDefault() {
      selectedListInfo.current = null
      handleShow('default', settingState.setting['list.defaultPic'], '')
    },
  }))

  const handlePickCover = () => {
    void pickCoverImage().then(uri => {
      if (!uri) return
      tempCoverRef.current = uri
      setCoverRemoved(false)
      setCoverPreview(uri)
    }).catch(() => {
      toast(t('list_cover_fail'))
    })
  }

  const handleRemoveCover = () => {
    tempCoverRef.current = ''
    setCoverRemoved(true)
    setCoverPreview(null)
  }

  const handleConfirm = async() => {
    if (mode == 'love') {
      try {
        if (tempCoverRef.current) {
          const pic = await saveCustomCover(LIST_IDS.LOVE, tempCoverRef.current)
          setLoveCover(pic, true)
          // 指针生效后清旧（三席代码审查 I4：先删旧后改指针非原子）
          void cleanCustomCovers(LIST_IDS.LOVE, pic.split('/').pop())
        } else if (coverRemoved) {
          // 移除回自动轨重生成（2026-10-23 LOVE 纳入自动轨批，与 default 形态同语义）
          setLoveCover(null, false)
          void cleanCustomCovers(LIST_IDS.LOVE)
          queueCoverGen(LIST_IDS.LOVE, true)
        }
      } catch {
        toast(t('list_cover_fail'))
      }
      alertRef.current?.setVisible(false)
      return
    }
    if (mode == 'default') {
      // 默认歌单封面（2026-10-18 拍板纳入）：setting 双键通道；移除回自动轨立即重生成
      try {
        if (tempCoverRef.current) {
          const pic = await saveCustomCover(LIST_IDS.DEFAULT, tempCoverRef.current)
          setDefaultCover(pic, true)
          void cleanCustomCovers(LIST_IDS.DEFAULT, pic.split('/').pop())
        } else if (coverRemoved) {
          setDefaultCover(null, false)
          void cleanCustomCovers(LIST_IDS.DEFAULT)
          queueCoverGen(LIST_IDS.DEFAULT, true)
        }
      } catch {
        toast(t('list_cover_fail'))
      }
      alertRef.current?.setVisible(false)
      return
    }
    const listInfo = selectedListInfo.current
    if (!listInfo) return
    let name = nameInputRef.current?.getText() ?? ''
    if (!name.length) return
    if (name.length > 100) name = name.substring(0, 100)
    const fresh = listState.userList.find(l => l.id === listInfo.id)
    if (!fresh) {
      // 面板打开期间歌单被并发删除（如另一端同步）：提示并关面板，防卡死（三席代码审查 S10）
      toast(global.i18n.t('load_failed_tip'))
      alertRef.current?.setVisible(false)
      return
    }
    if (listState.userList.some(l => l.name == name && l.id != fresh.id) && !(await confirmDialog({
      message: global.i18n.t('list_duplicate_tip'),
    }))) return
    // 封面落盘与元数据落库分层容错：封面失败 toast 封面文案；落库失败 toast 通用失败
    let picPatch: { pic: string, picCustom: boolean } | null = null
    if (tempCoverRef.current) {
      try {
        picPatch = { pic: await saveCustomCover(fresh.id, tempCoverRef.current), picCustom: true }
      } catch {
        toast(t('list_cover_fail'))
        alertRef.current?.setVisible(false)
        return
      }
    }
    try {
      if (picPatch) {
        await updateUserList([{ ...fresh, name, ...picPatch }])
        // 指针生效后清旧（三席代码审查 I4）
        void cleanCustomCovers(fresh.id, picPatch.pic.split('/').pop())
      } else if (coverRemoved) {
        await updateUserList([{ ...fresh, name, pic: '', picCustom: false }])
        void cleanCustomCovers(fresh.id)
      } else {
        await updateUserList([{ ...fresh, name }])
      }
    } catch {
      toast(global.i18n.t('load_failed_tip'))
    }
    alertRef.current?.setVisible(false)
  }

  const title = mode == 'user'
    ? t('list_edit_list')
    : mode == 'collect'
      ? t('list_rename_title')
      // love 专属键与 default 中性键分流（三席审查 S-8：防后续改 love 文案波及 DEFAULT）
      : mode == 'love' ? t('list_love_edit_cover') : t('list_edit_cover')

  return (
    visible
      ? <ConfirmAlert
          ref={alertRef}
          onConfirm={handleConfirm}
        >
          <View style={styles.renameContent}>
            <Text style={{ marginBottom: SPACING.s6 }}>{title}</Text>
            {
              mode != 'collect'
                ? (
                    <View style={styles.coverRow}>
                      <TouchableOpacity style={styles.coverPress} activeOpacity={0.7} onPress={handlePickCover}>
                        {
                          coverPreview
                            ? <Image url={coverPreview} style={styles.cover} />
                            : (
                                <View style={{ ...styles.cover, ...styles.coverEmpty, borderColor: theme['c-border-background'] }}>
                                  <Icon name="plus" size={ICON_SIZE.control} color={theme['c-font-label']} />
                                </View>
                              )
                        }
                      </TouchableOpacity>
                      <View style={styles.coverActions}>
                        <Text size={13} color={theme['c-font-label']}>{t('list_select_cover')}</Text>
                        {
                          coverPreview
                            ? (
                                <TouchableOpacity activeOpacity={0.7} onPress={handleRemoveCover}>
                                  <Text size={13} color={theme['c-primary']}>{t('list_remove_cover')}</Text>
                                </TouchableOpacity>
                              )
                            : null
                        }
                      </View>
                    </View>
                  )
                : null
            }
            {mode != 'love' && mode != 'default' && <NameInput ref={nameInputRef} />}
          </View>
        </ConfirmAlert>
      : null
  )
})


const styles = createStyle({
  renameContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
    gap: SPACING.s6,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 290,
    borderRadius: 4,
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
  },
  coverPress: {
    flexGrow: 0,
    flexShrink: 0,
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
  coverActions: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
    gap: SPACING.s6,
  },
})

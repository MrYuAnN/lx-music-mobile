import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Popup, { type PopupType } from '@/components/common/Popup'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 添加规则表单（治理批 P5）：类型切换（歌曲+歌手/仅歌曲/仅歌手）+ 结构化输入，
// 写入经 utils/dislikeManage 转义单点（@→#），表单形态为本产品自定（聚合源无歌手搜索能力）
type RuleType = 'songSinger' | 'song' | 'singer'

const TYPES: Array<{ id: RuleType, labelKey: 'dislike_type_song_singer' | 'dislike_type_song' | 'dislike_type_singer' }> = [
  { id: 'songSinger', labelKey: 'dislike_type_song_singer' },
  { id: 'song', labelKey: 'dislike_type_song' },
  { id: 'singer', labelKey: 'dislike_type_singer' },
]

export interface AddRuleSheetType {
  show: () => void
}

interface Props {
  onAdd: (name: string, singer: string) => void
}

const AddRuleSheet = forwardRef<AddRuleSheetType, Props>(({ onAdd }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const popupRef = useRef<PopupType>(null)
  const [visible, setVisible] = useState(false)
  const [type, setType] = useState<RuleType>('songSinger')
  const [name, setName] = useState('')
  const [singer, setSinger] = useState('')

  useImperativeHandle(ref, () => ({
    show() {
      setName('')
      setSinger('')
      setType('songSinger')
      if (visible) popupRef.current?.setVisible(true)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
        })
      }
    },
  }), [visible])

  // 校验（审查 I3）：「歌曲+歌手」类型歌手必填——留空会静默降级为「仅歌曲」规则，
  // 拉黑范围意外扩大到所有同名歌，与用户意图相悖
  const handleConfirm = () => {
    if ((type == 'songSinger' || type == 'song') && !name.trim()) {
      toast(t('dislike_add_empty_tip'))
      return
    }
    if ((type == 'songSinger' || type == 'singer') && !singer.trim()) {
      toast(t('dislike_add_empty_tip'))
      return
    }
    onAdd(name.trim(), type == 'song' ? '' : singer.trim())
    popupRef.current?.setVisible(false)
  }

  return (
    visible
      ? (
          <Popup ref={popupRef} title={t('dislike_add_title')} handle closeBtn={false} onHide={() => { setName(''); setSinger('') }}>
            <View style={styles.content}>
              <View style={styles.types}>
                {
                  TYPES.map(({ id, labelKey }) => (
                    <TouchableOpacity
                      key={id}
                      style={{ ...styles.typeChip, backgroundColor: type == id ? theme['c-primary'] : theme['c-glass-fill'] }}
                      onPress={() => { setType(id) }}
                    >
                      <Text size={13} color={type == id ? theme['c-on-primary'] : theme['c-font']}>{t(labelKey)}</Text>
                    </TouchableOpacity>
                  ))
                }
              </View>
              {
                type != 'singer'
                  ? (
                      <Input
                        value={name}
                        onChangeText={setName}
                        placeholder={t('dislike_input_song_name')}
                        style={styles.input}
                      />
                    )
                  : null
              }
              {
                type != 'song'
                  ? (
                      <Input
                        value={singer}
                        onChangeText={setSinger}
                        placeholder={t('dislike_input_singer_name')}
                        style={styles.input}
                      />
                    )
                  : null
              }
              <Text size={12} color={theme['c-font-label']} style={styles.tip}>{t('dislike_escape_tip')}</Text>
              <Button style={{ ...styles.confirmBtn, backgroundColor: theme['c-primary'] }} onPress={handleConfirm}>
                <Text size={14} color={theme['c-on-primary']}>{t('confirm')}</Text>
              </Button>
            </View>
          </Popup>
        )
      : null
  )
})

const styles = createStyle({
  content: {
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s24,
    paddingTop: SPACING.s10,
  },
  types: {
    flexDirection: 'row',
    marginBottom: SPACING.s12,
    gap: SPACING.s10,
  },
  typeChip: {
    paddingHorizontal: SPACING.s12,
    paddingVertical: SPACING.s6,
    borderRadius: 999,
  },
  input: {
    marginBottom: SPACING.s10,
  },
  tip: {
    marginTop: SPACING.s2,
    marginBottom: SPACING.s12,
  },
  confirmBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.s10,
    borderRadius: 999,
  },
})

export default AddRuleSheet

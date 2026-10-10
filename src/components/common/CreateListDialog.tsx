import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'

import Dialog, { type DialogType } from './Dialog'
import Input, { type InputType } from './Input'
import Text from './Text'
import Button from './Button'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createList } from '@/core/list'
import listState from '@/store/list/state'
import { confirmDialog } from '@/utils/tools'

// 新建歌单弹层（AM-6 首页返工）：显式「取消/创建」双按钮，仅提交键触发创建
// （不复用 CreateUserList 的 onBlur 提交行内形态——弹层取消语义冲突，方案 §3.7.2 [审查修订]）
export interface CreateListDialogType {
  show: () => void
}

const CreateListDialog = (_: unknown, ref: React.Ref<CreateListDialogType>) => {
  const theme = useTheme()
  const t = useI18n()
  const dialogRef = useRef<DialogType>(null)
  const inputRef = useRef<InputType>(null)
  const [text, setText] = useState('')

  useImperativeHandle(ref, () => ({
    show() {
      setText('')
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
      dialogRef.current?.setVisible(true)
    },
  }))

  const hide = () => {
    dialogRef.current?.setVisible(false)
  }

  const handleCreate = async() => {
    const name = text.trim()
    if (!name.length) return
    if (listState.userList.some(l => l.name == name) && !(await confirmDialog({
      message: global.i18n.t('list_duplicate_tip'),
    }))) return
    hide()
    // 新歌单置顶插入（对齐 AM 最近添加在顶部惯例）；实体构造收口到 core 的 createList
    void createList({ name, position: 0 })
  }

  return (
    <Dialog ref={dialogRef} title={t('list_create')} closeBtn={false} bgHide={false}>
      <View style={styles.container}>
        <Input
          placeholder={t('list_create_input_placeholder')}
          value={text}
          maxLength={30}
          onChangeText={setText}
          ref={inputRef}
          onSubmitEditing={() => { void handleCreate() }}
          style={styles.input}
        />
        <View style={styles.btns}>
          <Button style={styles.btn} onPress={hide}>
            <Text size={14} color={theme['c-font']}>{t('cancel')}</Text>
          </Button>
          <Button style={{ ...styles.btn, backgroundColor: theme['c-primary'] }} onPress={() => { void handleCreate() }}>
            <Text size={14} color={theme['c-button-font']}>{t('confirm')}</Text>
          </Button>
        </View>
      </View>
    </Dialog>
  )
}

// Button 子内容为文本时的简化渲染；create 键缺失时回退 ok
const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 14,
  },
  input: {
    fontSize: 14,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
})

export default forwardRef(CreateListDialog) as (p: { ref?: React.Ref<CreateListDialogType> }) => JSX.Element | null

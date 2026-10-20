import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import useDialogBlurBehind from '@/components/common/useDialogBlurBehind'
import { GLASS_TINT } from '@/components/common/GlassSurface'
import { MASK_COLOR } from '@/components/common/SheetBase'
import { DIALOG_RADIUS } from '@/components/common/Dialog'

interface Props {
  children: React.ReactNode
}

// 居中弹窗内容基座（导航层 VersionModal/SyncModeModal，弹窗体系统一方案批1）：
// 与 Dialog 同规格——跨窗 blur-behind 玻璃 tint 分流（回退实色）+DIALOG_RADIUS 14+遮罩单源；
// 旧色条 header 移除（VersionModal/SyncModeModal 内容自带标题，删色条不丢标题——审查 I-4；
// 旧 borderTopRadius 4 不随面板改 14 会顶出圆角边界）
export default ({ children }: Props) => {
  const theme = useTheme()
  const { blurBehind } = useDialogBlurBehind()

  return (
    <View style={{ ...styles.centeredView, backgroundColor: MASK_COLOR }}>
      <View style={{ ...styles.modalView, backgroundColor: blurBehind ? GLASS_TINT[theme.isDark ? 'dark' : 'light'] : theme['c-content-background'] }}>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    maxWidth: '90%',
    minWidth: '60%',
    maxHeight: '78%',
    borderRadius: DIALOG_RADIUS,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
})

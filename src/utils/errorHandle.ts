import { Alert } from 'react-native'
// import { exitApp } from '@/utils/common'
import { log } from '@/utils/log'
import { toast } from './tools'

const errorHandler = (e: Error, isFatal: boolean) => {
  const excludedErrors = [
    'Failed to construct \'Response\'',
  ]
  if (isFatal) {
    if (excludedErrors.some((excludedError) => e.message.includes(excludedError))) {
      toast('应用遇到了错误，如果你有固定的复现方式，请截图并在 GitHub 反馈（并附上具体的操作步骤，以及“设置-错误日志”的内容）')
    } else {
      Alert.alert(
        '💥Unexpected error occurred💥',
        `
  应用出 bug 了😭，以下是错误异常信息。请截图并在 GitHub 反馈（并附上刚才你进行了什么操作，以及附上“设置-错误日志”的内容）。现在应用可能会出现异常，若出现异常请尝试强制结束应用后重新启动！

  Error:
  ${isFatal ? 'Fatal:' : ''} ${e.name} ${e.message}
  `,
        [{
          text: '关闭 (Close)',
          onPress: () => {
            // exitApp()
          },
        }],
      )
    }
  }
  log.error(e.stack)
}

// N2 后挂账落地：react-native-exception-handler（上游停更 2024-07，Gradle 9/AGP 8 需 patch 续命）
// 退役，JS 异常兜底直接用 RN 内建 ErrorUtils（setJSExceptionHandler 的底层等价物，语义不变）；
// native crash 本地日志能力随库退役放弃（拍板接受）
interface ErrorUtilsLike {
  setGlobalHandler: (handler: (error: Error, isFatal: boolean) => void) => void
}

if (process.env.NODE_ENV !== 'development') {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
  errorUtils?.setGlobalHandler(errorHandler)
}

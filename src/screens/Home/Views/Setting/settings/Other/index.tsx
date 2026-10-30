import { memo, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'

import SettingSection from '../../components/SettingSection'
import ActionRow from '../../components/ActionRow'
import Popup, { type PopupType } from '@/components/common/Popup'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { createStyle, toast, confirmDialog, resetNotificationPermissionCheck, resetIgnoringBatteryOptimizationCheck } from '@/utils/tools'
import { getAppCacheSize, clearAppCache } from '@/utils/nativeModules/cache'
import { getCacheSize, clearCache } from '@/plugins/player/utils'
import { sizeFormate } from '@/utils'
import { clearMusicUrl, clearLyric, clearOtherSource, getMetaCache } from '@/utils/data'
import { getLogs, clearLogs } from '@/utils/log'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'

// 缓存与日志节（治理批 P13：六行归一组卡——三个缓存行=label+数值+行尾清除钮（iOS 储存空间/
// 微信存储清理范式），「查看日志」为动作行+底部 Popup 滚动区
// （替代 ConfirmAlert 文本堆）。P11 已删同步日志开关。旧 ResourceCache/MetaCache/Log 三组件
// 及 SubTitle+填充矩形按钮形态退役）

interface CacheInfo {
  appSize: string | null
  otherSourceKeys: string[] | null
  lyricKeys: string[] | null
}

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [cleaning, setCleaning] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ appSize: null, otherSourceKeys: null, lyricKeys: null })
  // 日志查看弹层
  const popupRef = useRef<PopupType>(null)
  const [logVisible, setLogVisible] = useState(false)
  const [logText, setLogText] = useState('')
  const isUnmountedRef = useRef(true)

  const loadCacheInfo = () => {
    void Promise.all([getAppCacheSize(), getCacheSize(), getMetaCache()]).then(([appSize, playerSize, meta]) => {
      if (isUnmountedRef.current) return
      setCacheInfo({
        appSize: sizeFormate(appSize + playerSize),
        otherSourceKeys: meta.otherSourceKeys ?? [],
        lyricKeys: meta.lyricKeys ?? [],
      })
    })
  }

  useEffect(() => {
    isUnmountedRef.current = false
    loadCacheInfo()
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const handleCleanAppCache = () => {
    void confirmDialog({
      message: t('confirm_tip'),
      confirmButtonText: t('dialog_reset'),
    }).then(confirm => {
      if (!confirm) return
      setCleaning(true)
      void Promise.all([
        clearAppCache(),
        clearCache(),
        clearMusicUrl(),
        resetNotificationPermissionCheck(),
        resetIgnoringBatteryOptimizationCheck(),
      ]).then(() => {
        toast(t('setting_other_cache_clear_success_tip'))
      }).finally(() => {
        loadCacheInfo()
        setCleaning(false)
      })
    })
  }

  const handleCleanOtherSource = () => {
    if (!cacheInfo.otherSourceKeys?.length) return
    void clearOtherSource(cacheInfo.otherSourceKeys).then(() => {
      toast(t('setting_other_cache_clear_success_tip'))
      loadCacheInfo()
    })
  }

  const handleCleanLyric = () => {
    if (!cacheInfo.lyricKeys?.length) return
    void clearLyric(cacheInfo.lyricKeys).then(() => {
      toast(t('setting_other_cache_clear_success_tip'))
      loadCacheInfo()
    })
  }

  const openLogPopup = () => {
    void getLogs().then(log => {
      if (isUnmountedRef.current) return
      // 双分隔符兼容（代码审查 S-9）：旧日志文件含 lx 分隔符，解析端双轨直至旧日志轮转淘汰
      const logArr = log.split(/^----lx log----\n|\n----lx log----\n|\n----lx log----$|^----sy log----\n|\n----sy log----\n|\n----sy log----$/)
      logArr.reverse()
      setLogText(logArr.join('\n\n').replace(/^\n+|\n+$/, ''))
    })
    setLogVisible(true)
    requestAnimationFrame(() => {
      popupRef.current?.setVisible(true)
    })
  }

  const handleCleanLog = () => {
    void clearLogs().then(() => {
      toast(t('setting_other_log_tip_clean_success'))
      setLogText('')
    })
  }

  const countText = (keys: string[] | null) => keys == null ? t('setting_other_cache_getting') : t('setting_other_cache_count', { num: keys.length })

  return (
    <SettingSection title={t('setting_other_section_title')}>
      <ActionRow
        label={t('setting_other_cache_row_app')}
        value={cacheInfo.appSize ?? t('setting_other_cache_getting')}
        actionLabel={t('setting_other_cache_clear')}
        onPress={handleCleanAppCache}
        disabled={cleaning || cacheInfo.appSize == null}
      />
      <ActionRow
        label={t('setting_other_cache_row_source')}
        value={countText(cacheInfo.otherSourceKeys)}
        actionLabel={t('setting_other_cache_clear')}
        onPress={handleCleanOtherSource}
        disabled={!cacheInfo.otherSourceKeys?.length}
      />
      <ActionRow
        label={t('setting_other_cache_row_lyric')}
        value={countText(cacheInfo.lyricKeys)}
        actionLabel={t('setting_other_cache_clear')}
        onPress={handleCleanLyric}
        disabled={!cacheInfo.lyricKeys?.length}
      />
      <ActionRow label={t('setting_other_log_view')} onPress={openLogPopup} />
      {
        logVisible
          ? (
              <Popup ref={popupRef} title={t('setting_other_log_view')} handle closeBtn={false} onHide={() => { setLogVisible(false) }}>
                <View style={styles.logContent}>
                  <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false}>
                    {
                      logText
                        ? <Text selectable size={12} color={theme['c-font']}>{logText}</Text>
                        : <Text size={13} color={theme['c-font-label']}>{t('setting_other_log_tip_null')}</Text>
                    }
                  </ScrollView>
                  <View style={styles.logBtns}>
                    <Button
                      style={{ ...styles.logBtn, backgroundColor: theme['c-button-background'] }}
                      onPress={() => { popupRef.current?.setVisible(false) }}
                    >
                      <Text size={14} color={theme['c-button-font']}>{t('setting_other_log_btn_hide')}</Text>
                    </Button>
                    {
                      logText
                        ? (
                            <Button
                              style={{ ...styles.logBtn, backgroundColor: theme['c-button-background'] }}
                              onPress={handleCleanLog}
                            >
                              <Text size={14} color={theme['c-primary-font']}>{t('setting_other_log_btn_clean')}</Text>
                            </Button>
                          )
                        : null
                    }
                  </View>
                </View>
              </Popup>
            )
          : null
      }
    </SettingSection>
  )
})

const styles = createStyle({
  logContent: {
    height: 320,
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s16,
  },
  logScroll: {
    flex: 1,
  },
  logBtns: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.s12,
    paddingTop: SPACING.s12,
  },
  logBtn: {
    paddingHorizontal: SPACING.s24,
    paddingVertical: SPACING.s10,
    borderRadius: 999,
  },
})

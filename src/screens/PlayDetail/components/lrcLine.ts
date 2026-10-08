import { useMemo } from 'react'
import { type Line } from '@/plugins/lyric'
import { useTheme } from '@/store/theme/hook'
import { FONT_WHITE, FONT_WHITE_70 } from '../constant'

export interface LrcLineProps {
  line: Line
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
}

// 与当前行的距离档位（0=当前行），用于按距离做透明度渐变
export const getLineLevel = (lineNum: number, activeLine: number) => Math.min(Math.abs(lineNum - activeLine), 4)

export const useLrcLineColors = (level: number) => {
  const theme = useTheme()
  return useMemo(() => {
    if (level == 0) {
      return [
        theme['c-primary'],
        theme['c-primary-alpha-200'],
        1,
      ] as const
    }
    const opacity = level == 1 ? 0.72 : level == 2 ? 0.48 : level == 3 ? 0.3 : 0.2
    return [FONT_WHITE, FONT_WHITE_70, opacity] as const
  }, [level, theme])
}

export const lrcLineMemoComparator = (prevProps: LrcLineProps, nextProps: LrcLineProps) => {
  // 行内容相同且与当前行的距离档位不变时无需重渲染
  return prevProps.line === nextProps.line &&
    getLineLevel(prevProps.lineNum, prevProps.activeLine) === getLineLevel(nextProps.lineNum, nextProps.activeLine)
}

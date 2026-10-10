//! 更新默认主题配置后，需要执行 npm run build:theme 重新构建index.json
//! AM 化主题体系（doc/plans/apple-music-redesign.md §2.2）：仅 AM 浅色/深色两套，
//! 运行时「跟随系统(auto)」由 themes/index.ts getTheme 解析；旧 16 套主题 id
//! 迁移为读时映射到 auto（不写回存储）。色值推导见 themes/utils.js。

const fs = require('fs')
const path = require('path')
const { createThemeColors } = require('./utils')

const defaultThemes = [
  {
    id: 'am_light',
    name: 'AM 浅色',
    isDark: false,
    config: {
      primary: 'rgb(250, 35, 59)', // #FA233B
      font: 'rgb(0, 0, 0)',
      'c-app-background': 'rgb(242, 242, 247)', // #F2F2F7 systemGroupedBackground
      'c-main-background': 'rgba(255, 255, 255, 1)',
      'c-content-background': 'rgba(255, 255, 255, 1)',
      'c-border-background': 'rgba(60, 60, 67, 0.12)',
      'c-font': 'rgb(0, 0, 0)',
      'c-font-label': 'rgb(138, 138, 142)', // #8A8A8E

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': 'rgb(138, 138, 142)',
      'c-badge-tertiary': 'rgb(138, 138, 142)',
    },
  },
  {
    id: 'am_dark',
    name: 'AM 深色',
    isDark: true,
    config: {
      primary: 'rgb(251, 75, 84)', // #FB4B54 暗底提亮
      font: 'rgb(255, 255, 255)',
      'c-app-background': 'rgb(0, 0, 0)',
      'c-main-background': 'rgba(28, 28, 30, 1)', // #1C1C1E
      'c-content-background': 'rgba(28, 28, 30, 1)',
      'c-border-background': 'rgba(84, 84, 88, 0.40)',
      'c-font': 'rgb(255, 255, 255)',
      'c-font-label': 'rgb(152, 152, 159)', // #98989F

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': 'rgb(152, 152, 159)',
      'c-badge-tertiary': 'rgb(152, 152, 159)',
    },
  },
]

const themes = defaultThemes.map(({ config: { primary, font, ...extInfo }, ...themeInfo }) => {
  return {
    ...themeInfo,
    isCustom: false,
    config: {
      themeColors: createThemeColors(primary, font, themeInfo.isDark),
      extInfo,
    },
  }
})

fs.writeFileSync(path.join(__dirname, 'themes.ts'), `/* eslint-disable */\n//! 此文件由 createThemes.js 生成\n\nexport default ${JSON.stringify(themes, null, 2)} as const`)

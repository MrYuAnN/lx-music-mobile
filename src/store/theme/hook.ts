import { useContext } from 'react'
import { ThemeContext } from './state'

export const useTheme = () => useContext(ThemeContext)

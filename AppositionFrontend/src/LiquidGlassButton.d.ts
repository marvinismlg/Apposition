import type { CSSProperties, ReactNode } from 'react'

export interface LiquidGlassButtonProps {
  label?: string
  link?: string
  newTab?: boolean
  material?: 'clear' | 'frosted' | 'tinted'
  surface?: 'light' | 'dark'
  tint?: string
  textColor?: string
  font?: CSSProperties
  icon?: 'chevron' | 'custom' | 'none' | 'arrow' | 'diagonal' | 'plus'
  iconLayer?: ReactNode
  iconPosition?: 'left' | 'right'
  radius?: string | number
  padding?: string
  gap?: string
  glass?: { blur?: number; shoulder?: number; refraction?: number }
  interaction?: boolean
  lightFollow?: number
  disabled?: boolean
  onTap?: () => void
  type?: 'button' | 'submit'
  focusColor?: string
  style?: CSSProperties
}

export default function LiquidGlassButton(props: LiquidGlassButtonProps): ReactNode

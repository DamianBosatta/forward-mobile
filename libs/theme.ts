import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { Appearance } from 'react-native'
import type { TextStyle } from 'react-native'

// ── Forward V3.5 Design Tokens ─────────────────────────────────────────────
// Mapeo 1:1 con tokens.css de la web (packages/ui/src/tokens.css)

export type ThemeMode = 'dark' | 'light' | 'system'

export interface ForwardColors {
  bg: string
  background: string // Alias para bg
  surface: string
  surface2: string
  surface3: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  textSecondary: string // Alias para textMuted
  textDisabled: string
  primary: string
  primaryHover: string
  secondary: string
  success: string
  warning: string
  danger: string
  info: string
  glassBg: string
  glassBorder: string
  inputBg: string
  cardBg: string
}

const DARK_COLORS: ForwardColors = {
  bg:           '#000000', // Black OLED
  background:   '#000000',
  surface:      '#0a0a0a', // Casi negro para elevación inicial
  surface2:     '#121212', 
  surface3:     '#1a1a1a', 
  border:       '#1a1a1a',
  borderStrong: '#2a2a2a',
  text:         '#f8fafc', // Slate 50
  textMuted:    '#a3a3a3', // Neutral 400
  textSecondary:'#a3a3a3',
  textDisabled: '#525252',
  primary:      '#00d1c1', // Forward Teal Vibrante
  primaryHover: '#00b4a2',
  secondary:    '#38bdf8', 
  success:      '#10b981',
  warning:      '#f59e0b',
  danger:       '#ef4444',
  info:         '#0ea5e9',
  glassBg:      'rgba(0, 0, 0, 0.5)',
  glassBorder:  'rgba(255, 255, 255, 0.08)',
  inputBg:      '#000000',
  cardBg:       '#050505',
}

const LIGHT_COLORS: ForwardColors = {
  bg:           '#f1f5f9', // Slate 100 (antes f4f7fa)
  background:   '#f1f5f9',
  surface:      '#ffffff',
  surface2:     '#e2e8f0', // Slate 200 (antes ebf0f5)
  surface3:     '#e2e8f0',
  border:       '#e2e8f0',
  borderStrong: '#cbd5e1',
  text:         '#0f172a', // Slate 900
  textMuted:    '#475569', // Slate 600 (antes 64748b)
  textSecondary:'#475569',
  textDisabled: '#64748b', // Slate 500 (antes 94a3b8)
  primary:      '#00b4a2', 
  primaryHover: '#008f81',
  secondary:    '#0ea5e9',
  success:      '#16a34a',
  warning:      '#d97706',
  danger:       '#dc2626',
  info:         '#2563eb',
  glassBg:      'rgba(255,255,255,0.85)',
  glassBorder:  'rgba(0,0,0,0.08)',
  inputBg:      '#ffffff',
  cardBg:       '#ffffff',
}

// ── Brand Constants ────────────────────────────────────────────────────────

export const BRAND = {
  blue:     '#3B82F6',
  blueDark: '#2563EB',
  lime:     '#A3E635',
  limeDark: '#84cc16',
  fontSans: 'Outfit',
  violet:   '#8b5cf6',
  orange:   '#f97316',
  green:    '#10b981',
  red:      '#ef4444',
  fontMono: 'JetBrains Mono',
} as const

// ── Design Tokens ──────────────────────────────────────────────────────────

export type TypographyToken = {
  size: number
  lineHeight: number
  weight?: TextStyle['fontWeight']
}

export const tokens = {
  radius: {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    premium: {
      shadowColor: '#00d1c1',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.25,
      shadowRadius: 40,
      elevation: 15,
    }
  },
  typography: {
    xs:    { size: 10, lineHeight: 14 } as TypographyToken,
    sm:    { size: 12, lineHeight: 16 } as TypographyToken,
    base:  { size: 14, lineHeight: 20 } as TypographyToken,
    md:    { size: 16, lineHeight: 22 } as TypographyToken,
    lg:    { size: 18, lineHeight: 24 } as TypographyToken,
    xl:    { size: 22, lineHeight: 28 } as TypographyToken,
    '2xl': { size: 26, lineHeight: 32 } as TypographyToken,
    '3xl': { size: 32, lineHeight: 38 } as TypographyToken,
  },
  fontFamily: {
    sans: BRAND.fontSans, // 'Outfit'
    mono: BRAND.fontMono, // 'JetBrains Mono'
  },
}

// ── Theme Store (Zustand + SecureStore) ────────────────────────────────────

const STORAGE_KEY = 'forward_theme_mode'

interface ThemeState {
  mode: ThemeMode
  isHydrated: boolean
  setMode: (mode: ThemeMode) => void
  hydrate: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  isHydrated: false,

  setMode: async (mode: ThemeMode) => {
    set({ mode })
    await SecureStore.setItemAsync(STORAGE_KEY, mode)
  },

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY)
      if (stored && (stored === 'dark' || stored === 'light' || stored === 'system')) {
        set({ mode: stored as ThemeMode, isHydrated: true })
      } else {
        set({ isHydrated: true })
      }
    } catch {
      set({ isHydrated: true })
    }
  },
}))

// ── Hook: Resolved Colors ──────────────────────────────────────────────────

export function useColors(): ForwardColors {
  const { mode } = useThemeStore()

  if (mode === 'system') {
    const systemScheme = Appearance.getColorScheme()
    return systemScheme === 'light' ? LIGHT_COLORS : DARK_COLORS
  }

  return mode === 'light' ? LIGHT_COLORS : DARK_COLORS
}

export function useIsDark(): boolean {
  const { mode } = useThemeStore()

  if (mode === 'system') {
    return Appearance.getColorScheme() !== 'light'
  }

  return mode === 'dark'
}


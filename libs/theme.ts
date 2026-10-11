import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { useColorScheme } from 'react-native'
import type { TextStyle } from 'react-native'
import { logger } from '@/core/utils/logger'

// ── Tokens del Bloque 9 (plan §7 y §10) ────────────────────────────────────
// Los dos temas usan los MISMOS nombres: la pantalla se programa una vez y el
// tema cambia los valores. Fuente: tokens.css de la web (claro y bloque .dark)
// más los tokens nuevos que existen porque el valor de la web no llega a 4,5:1.
//
// Claves legadas (las consumen las pantallas viejas) → token aprobado:
//   bg, background      → fondo
//   surface, cardBg     → superficie
//   surface2, inputBg   → superficie-2
//   surface3            → superficie-2 (legado: no hay superficie-3)
//   border, borderStrong→ borde (legado: hay un solo gris de borde)
//   text                → texto
//   textMuted, textSecondary, textDisabled → texto-secundario (legado: el
//                         deshabilitado no se marca bajando el contraste)
//   primary             → marca-tinta (es texto y fondo de botones viejos)
//   primaryHover        → marca-tinta presionada (legado)
//   secondary, info     → información (web --color-info; solo íconos)
//   success/warning/danger → estados de la web: SOLO íconos y puntos, nunca texto
//   glassBg, glassBorder→ superficie translúcida / borde (legado)

export type ThemeMode = 'dark' | 'light' | 'system'

export type ChipEstado =
  | 'confirmado'
  | 'pendiente'
  | 'porAutorizar'
  | 'enCurso'
  | 'entregado'
  | 'anulado'

export interface ChipColors {
  bg: string
  text: string
}

export interface ForwardColors {
  // ── Tokens aprobados ──
  brand: string // marca: acentos (pestaña activa, foco). Nunca texto sobre claro
  brandInk: string // marca-tinta: enlaces y texto teal
  brandSoft: string // marca-suave: selección
  action: string // botón primario y flotante
  onAction: string
  dangerStrong: string // botón de peligro
  onDangerStrong: string
  topBar: string // barra superior
  onTopBar: string // texto secundario en la barra
  onTopBarStrong: string // título e íconos de la barra (lámina F4)
  topBarBorder: string
  veil: string // velo de la hoja inferior. DECISIÓN PENDIENTE DEL DUEÑO: el plan §7.2 solo dice texto-secundario
  chip: Record<ChipEstado, ChipColors>
  // ── Claves legadas (ver mapeo arriba) ──
  bg: string
  background: string
  surface: string
  surface2: string
  surface3: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  textSecondary: string
  textDisabled: string
  primary: string
  onPrimary: string // texto sobre fondos `primary` (legado)
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

// Estados de la web: iguales en los dos temas, solo para íconos y puntos.
const ESTADOS_WEB = {
  success: '#21C45D',
  warning: '#FFA200',
  danger: '#EF4343',
  info: '#0DA2E7',
} as const

function conLegados(t: {
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  textSecondary: string
  brandInk: string
  brandInkPressed: string
  onPrimary: string
  glassBg: string
}) {
  return {
    bg: t.bg,
    background: t.bg,
    surface: t.surface,
    surface2: t.surface2,
    surface3: t.surface2,
    border: t.border,
    borderStrong: t.border,
    text: t.text,
    textMuted: t.textSecondary,
    textSecondary: t.textSecondary,
    textDisabled: t.textSecondary,
    primary: t.brandInk,
    onPrimary: t.onPrimary,
    primaryHover: t.brandInkPressed,
    secondary: ESTADOS_WEB.info,
    ...ESTADOS_WEB,
    glassBg: t.glassBg,
    glassBorder: t.border,
    inputBg: t.surface2,
    cardBg: t.surface,
  }
}

const LIGHT_COLORS: ForwardColors = {
  brand: '#00C29E',
  brandInk: '#0A7662',
  brandSoft: '#E0F8F3',
  action: '#2BD4BD',
  onAction: '#080D0C',
  dangerStrong: '#C52020',
  onDangerStrong: '#FFFFFF',
  topBar: '#0E1514',
  onTopBar: '#9DAFAB',
  onTopBarStrong: '#FFFFFF',
  topBarBorder: '#0E1514',
  veil: 'rgba(85, 109, 104, 0.85)', // texto-secundario #556D68 al 85 %
  chip: {
    confirmado: { bg: '#E0F8F3', text: '#0A7662' },
    pendiente: { bg: '#F0F0F0', text: '#556D68' },
    porAutorizar: { bg: '#FFF4E0', text: '#92610C' },
    enCurso: { bg: '#E2F4FC', text: '#0D6E9C' },
    entregado: { bg: '#E4F8EC', text: '#157A3A' },
    anulado: { bg: '#FDE8E8', text: '#A90F0F' },
  },
  ...conLegados({
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    surface2: '#F0F0F0',
    border: '#E0E0E0',
    text: '#141F1D',
    textSecondary: '#556D68',
    brandInk: '#0A7662',
    brandInkPressed: '#075A4B',
    onPrimary: '#FFFFFF',
    glassBg: 'rgba(255, 255, 255, 0.85)',
  }),
}

const DARK_COLORS: ForwardColors = {
  brand: '#00E6BB',
  brandInk: '#00E6BB',
  brandSoft: '#0B3B32',
  action: '#2BD4BD',
  onAction: '#080D0C',
  dangerStrong: '#C52020',
  onDangerStrong: '#FFFFFF',
  topBar: '#080D0C',
  onTopBar: '#9DAFAB',
  onTopBarStrong: '#EDF2F1',
  topBarBorder: '#273432',
  veil: 'rgba(8, 13, 12, 0.80)', // fondo oscuro #080D0C al 80 %
  chip: {
    confirmado: { bg: '#0B3B32', text: '#00E6BB' },
    pendiente: { bg: '#151E1C', text: '#9DAFAB' },
    porAutorizar: { bg: '#392E10', text: '#FFAB1A' },
    enCurso: { bg: '#0E2E3A', text: '#26B2F3' },
    entregado: { bg: '#113421', text: '#3BDE77' },
    anulado: { bg: '#361D1C', text: '#F15F5F' },
  },
  ...conLegados({
    bg: '#080D0C',
    surface: '#0E1514',
    surface2: '#151E1C',
    border: '#273432',
    text: '#EDF2F1',
    textSecondary: '#9DAFAB',
    brandInk: '#00E6BB',
    brandInkPressed: '#1AFFD5',
    onPrimary: '#080D0C',
    glassBg: 'rgba(14, 21, 20, 0.85)',
  }),
}

export const themeColors: Record<'light' | 'dark', ForwardColors> = {
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
}

// ── Brand Constants (legado) ───────────────────────────────────────────────
// Colores sueltos de la app vieja: no usarlos en código nuevo (usar useColors()).

export const BRAND = {
  blue:     '#3B82F6',
  blueDark: '#2563EB',
  lime:     '#A3E635',
  limeDark: '#84cc16',
  fontSans: 'Inter_400Regular', // Inter sola (plan §7)
  violet:   '#8b5cf6',
  orange:   '#f97316',
  green:    '#10b981',
  red:      '#ef4444',
  fontMono: 'JetBrains Mono',
} as const

// ── Fuente ─────────────────────────────────────────────────────────────────
// Inter es la única familia. Con fuentes propias, Android no elige el peso por
// fontWeight: el peso va en el nombre de la familia.
export const FONT = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
} as const

// ── Escala tipográfica (plan §7.3) ─────────────────────────────────────────

export interface TextToken {
  fontFamily: string
  fontSize: number
  fontWeight: TextStyle['fontWeight']
  lineHeight: number
}

const texto = (fontSize: number, peso: 400 | 600, lineHeight: number): TextToken => ({
  fontFamily: peso === 600 ? FONT.semibold : FONT.regular,
  fontSize,
  fontWeight: peso === 600 ? '600' : '400',
  lineHeight,
})

export const typeScale = {
  titulo: texto(20, 600, 28), // título de pantalla y totales
  seccion: texto(18, 600, 24),
  cuerpo: texto(16, 400, 24),
  cuerpoDestacado: texto(16, 600, 24), // nombres e importes de fila
  secundario: texto(14, 400, 20),
  etiqueta: texto(12, 600, 16), // solo chips y barra inferior
} as const

/** Importes: cifras tabulares (alinear a la derecha en la pantalla). */
export const importe: TextStyle = { fontVariant: ['tabular-nums'] }

// ── Radios, espaciado y sombra (plan §7.1) ─────────────────────────────────

export const radii = {
  campo: 10, // campos y botones (--radius-md)
  tarjeta: 16, // (--radius-lg)
  hoja: 24, // (--radius-xl)
  pastilla: 9999, // chips (--radius-full)
} as const

/** Base 4, como --space-1 … --space-12 de la web. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const

/** --shadow-md de la web, la única sombra. Claro: 0 4px 6px -1px / 0,1. Oscuro: 0 4px 8px -1px / 0,5. */
export const shadowMd = {
  light: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  dark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
} as const

// ── Design Tokens (legado) ─────────────────────────────────────────────────
// Los usan pantallas viejas. Código nuevo: typeScale, radii, space, shadowMd.

export type TypographyToken = {
  size: number
  lineHeight: number
  weight?: TextStyle['fontWeight']
}

export const tokens = {
  radius: {
    none: 0,
    sm: 8,
    md: radii.campo,
    lg: radii.tarjeta,
    xl: radii.hoja,
    '2xl': 32,
    full: radii.pastilla,
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
    md: shadowMd.light,
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
    sans: BRAND.fontSans,
    mono: BRAND.fontMono,
  },
}

// ── Theme Store (Zustand + SecureStore) ────────────────────────────────────

const STORAGE_KEY = 'forward_theme_mode'

interface ThemeState {
  mode: ThemeMode
  isHydrated: boolean
  setMode: (mode: ThemeMode) => Promise<void>
  hydrate: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system', // "Como el teléfono" (plan §10)
  isHydrated: false,

  setMode: async (mode: ThemeMode) => {
    set({ mode })
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, mode)
    } catch (err) {
      // La elección vale en esta sesión aunque no se pueda guardar.
      logger.warn('No se pudo guardar el modo de tema', err)
    }
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
  return useIsDark() ? DARK_COLORS : LIGHT_COLORS
}

export function useIsDark(): boolean {
  const { mode } = useThemeStore()
  // useColorScheme se suscribe al sistema: re-renderiza cuando el teléfono cambia.
  const systemScheme = useColorScheme()

  if (mode === 'system') {
    return systemScheme !== 'light'
  }

  return mode === 'dark'
}


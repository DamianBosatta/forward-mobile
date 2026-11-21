import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { useColorScheme } from 'react-native'
import type { TextStyle } from 'react-native'
import { logger } from '@/core/utils/logger'

// ── Tokens FWD (restyle, spec docs/mobile/restyle-fwd/00-spec.md §2-4) ────
// Los dos temas usan los MISMOS nombres: la pantalla se programa una vez y el
// tema cambia los valores. Los hex son los aprobados por el dueño (2026-11-20/21).
//
// Claves legadas (las consumen ~230 archivos) → token FWD. Una clave que se usa como TEXTO
// nunca apunta a un relleno (lime y rojo no se leen sobre blanco):
//   bg, background      → bg
//   surface, cardBg     → surface
//   surface2, surface3, inputBg → surfaceAlt
//   border              → line (separadores); borderStrong → contorno de controles (3:1)
//   text                → text
//   textMuted, textSecondary, textDisabled → textMuted (el deshabilitado no baja el contraste)
//   brand               → acento de contorno/indicador/tinte (accentText: 3:1 sobre surface y bg)
//   brandInk            → accentText (texto de acento: petróleo en claro, lime en oscuro)
//   brandSoft           → selección (tinte petróleo claro / surfaceAlt oscuro)
//   action, primary     → primaryBg (relleno de botón principal); onAction, onPrimary → primaryFg
//   primaryHover        → primaryBg presionado
//   danger              → rojo LEGIBLE como texto (claro #C52020, oscuro #FF6B5E); el relleno de la
//                         spec es dangerFill (#FF6B5E) con texto onState
//   warning             → #FFB020 (relleno de estado; solo íconos, puntos y rellenos con texto ink)
//   success, info, secondary → como hoy (S5)
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
  // ── Marca FWD (spec 00-spec.md §2): iguales en claro y oscuro ──
  lime: string // protagonista: tarjeta principal, bloques de cantidad. Texto encima: siempre `ink`
  teal: string // avance y "hecho". Nunca color de texto sobre fondo claro: para eso `accentText`
  ink: string // texto sobre lime, teal y estados
  // ── Por tema (spec §2) ──
  surfaceAlt: string
  accentText: string // texto de acento: petróleo en claro, lime en oscuro
  primaryBg: string // botón principal
  primaryFg: string
  fabBg: string // "Nueva venta": lime en claro, teal en oscuro
  onFab: string
  /** Relleno de estado de la spec (solo estados, texto `onState`, siempre con el estado escrito). */
  dangerFill: string
  onState: string
  // ── Tokens aprobados ──
  brand: string // acentos (pestaña activa, foco, borde de selección): legible como contorno 3:1
  brandInk: string // enlaces y texto de acento (= accentText)
  brandSoft: string // selección
  action: string // botón primario y flotante legado (= primaryBg)
  onAction: string
  dangerStrong: string // botón de peligro
  onDangerStrong: string
  topBar: string // barra superior: sobre el fondo de la pantalla (= bg), sin franja oscura (receta FWD .header)
  onTopBar: string // texto secundario en la barra (= textSecondary)
  onTopBarStrong: string // título e íconos de la barra (= text)
  topBarBorder: string // contorno de controles y tramos pendientes sobre la barra (= border)
  panelOscuro: string // superficie siempre oscura: hero de saldo, cámara, panel del login (no es el encabezado)
  onPanelOscuro: string
  onPanelOscuroStrong: string
  panelOscuroBorder: string
  veil: string // velo de la hoja inferior
  chip: Record<ChipEstado, ChipColors>
  /** Chips de estado de la spec FWD §5: relleno pleno con texto `ink` (pendiente: `surfaceAlt` con `text`). El estado va siempre escrito. `chip` queda para texto sobre `surface` (p. ej. errores). */
  chipFill: Record<ChipEstado, ChipColors>
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
  danger: string // legible como texto (hay pantallas que lo usan así); el relleno de la spec es `dangerFill`
  info: string
  glassBg: string
  glassBorder: string
  inputBg: string
  cardBg: string
}

// Marca y estados: iguales en los dos temas. `success` e `info` siguen como hoy (S5: el teal de marca no marca estados).
const MARCA = { lime: '#E0EB3C', teal: '#00AB96', ink: '#201E1E' } as const
const ESTADOS = {
  success: '#21C45D',
  warning: '#FFB020', // spec: solo estados, texto ink
  dangerFill: '#FF6B5E',
  onState: '#201E1E',
  info: '#0DA2E7',
} as const

function conLegados(t: {
  bg: string
  surface: string
  surfaceAlt: string
  border: string
  borderStrong: string
  text: string
  textSecondary: string
  accentText: string
  primaryBg: string
  primaryFg: string
  primaryPressed: string
  fabBg: string
  danger: string
  glassBg: string
}) {
  return {
    ...MARCA,
    ...ESTADOS,
    chipFill: {
      confirmado: { bg: MARCA.lime, text: MARCA.ink },
      pendiente: { bg: t.surfaceAlt, text: t.text },
      porAutorizar: { bg: ESTADOS.warning, text: ESTADOS.onState },
      enCurso: { bg: ESTADOS.info, text: ESTADOS.onState },
      entregado: { bg: MARCA.teal, text: MARCA.ink },
      anulado: { bg: ESTADOS.dangerFill, text: ESTADOS.onState },
    },
    surfaceAlt: t.surfaceAlt,
    accentText: t.accentText,
    primaryBg: t.primaryBg,
    primaryFg: t.primaryFg,
    fabBg: t.fabBg,
    onFab: MARCA.ink,
    bg: t.bg,
    background: t.bg,
    surface: t.surface,
    surface2: t.surfaceAlt,
    surface3: t.surfaceAlt,
    border: t.border,
    borderStrong: t.borderStrong,
    text: t.text,
    textMuted: t.textSecondary,
    textSecondary: t.textSecondary,
    textDisabled: t.textSecondary,
    primary: t.primaryBg,
    onPrimary: t.primaryFg,
    primaryHover: t.primaryPressed,
    secondary: ESTADOS.info,
    danger: t.danger,
    glassBg: t.glassBg,
    glassBorder: t.borderStrong,
    inputBg: t.surfaceAlt,
    cardBg: t.surface,
  }
}

const LIGHT_COLORS: ForwardColors = {
  brand: '#00796A',
  brandInk: '#00796A',
  brandSoft: '#EAF4F1',
  action: '#00796A',
  onAction: '#FFFFFF',
  dangerStrong: '#C52020',
  onDangerStrong: '#FFFFFF',
  topBar: '#F1F2EE',
  onTopBar: '#5A5757',
  onTopBarStrong: '#201E1E',
  topBarBorder: '#E2E3DE',
  panelOscuro: '#201E1E',
  onPanelOscuro: '#B5B2B3',
  onPanelOscuroStrong: '#F5F5F1',
  panelOscuroBorder: '#201E1E',
  veil: 'rgba(90, 87, 87, 0.85)', // textMuted #5A5757 al 85 %
  chip: {
    confirmado: { bg: '#EAF4F1', text: '#00796A' },
    pendiente: { bg: '#E2E3DE', text: '#5A5757' },
    porAutorizar: { bg: '#FFF1D6', text: '#8A5A00' },
    enCurso: { bg: '#E2F4FC', text: '#0D6E9C' },
    entregado: { bg: '#E4F8EC', text: '#157A3A' },
    anulado: { bg: '#FFE6E3', text: '#B3261E' },
  },
  ...conLegados({
    bg: '#F1F2EE',
    surface: '#FFFFFF',
    surfaceAlt: '#E2E3DE',
    border: '#E2E3DE',
    borderStrong: '#7A7778',
    text: '#201E1E',
    textSecondary: '#5A5757',
    accentText: '#00796A',
    primaryBg: '#00796A',
    primaryFg: '#FFFFFF',
    primaryPressed: '#005A4F',
    fabBg: '#E0EB3C',
    danger: '#C52020',
    glassBg: 'rgba(255, 255, 255, 0.85)',
  }),
}

const DARK_COLORS: ForwardColors = {
  brand: '#E0EB3C',
  brandInk: '#E0EB3C',
  brandSoft: '#3A3637',
  action: '#E0EB3C',
  onAction: '#201E1E',
  dangerStrong: '#C52020',
  onDangerStrong: '#FFFFFF',
  topBar: '#141213',
  onTopBar: '#B5B2B3',
  onTopBarStrong: '#F5F5F1',
  topBarBorder: '#454142',
  panelOscuro: '#141213',
  onPanelOscuro: '#B5B2B3',
  onPanelOscuroStrong: '#F5F5F1',
  panelOscuroBorder: '#454142',
  veil: 'rgba(20, 18, 19, 0.80)', // fondo oscuro #141213 al 80 %
  chip: {
    confirmado: { bg: '#3A3637', text: '#E0EB3C' },
    pendiente: { bg: '#3A3637', text: '#B5B2B3' },
    porAutorizar: { bg: '#4A3A12', text: '#FFB020' },
    enCurso: { bg: '#0E2E3A', text: '#26B2F3' },
    entregado: { bg: '#113421', text: '#3BDE77' },
    anulado: { bg: '#4A2320', text: '#FF8478' },
  },
  ...conLegados({
    bg: '#141213',
    surface: '#2A2728',
    surfaceAlt: '#3A3637',
    border: '#454142',
    borderStrong: '#8C8889',
    text: '#F5F5F1',
    textSecondary: '#B5B2B3',
    accentText: '#E0EB3C',
    primaryBg: '#E0EB3C',
    primaryFg: '#201E1E',
    primaryPressed: '#CAD535',
    fabBg: '#00AB96',
    danger: '#FF6B5E',
    glassBg: 'rgba(42, 39, 40, 0.85)',
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
  fontSans: 'Manrope_600SemiBold', // Manrope 600/700/800 (spec §3)
  violet:   '#8b5cf6',
  orange:   '#f97316',
  green:    '#10b981',
  red:      '#ef4444',
  fontMono: 'JetBrains Mono',
} as const

// ── Fuente ─────────────────────────────────────────────────────────────────
// Manrope 600/700/800 (spec §3). Con fuentes propias, Android no elige el peso por
// fontWeight: el peso va en el nombre de la familia. No hay peso 400: `regular` es el 600.
export const FONT = {
  regular: 'Manrope_600SemiBold',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const

// ── Escala tipográfica (plan §7.3) ─────────────────────────────────────────

export interface TextToken {
  fontFamily: string
  fontSize: number
  fontWeight: TextStyle['fontWeight']
  lineHeight: number
  letterSpacing?: number
}

type Peso = 600 | 700 | 800

const FAMILIA_POR_PESO: Record<Peso, string> = { 600: FONT.semibold, 700: FONT.bold, 800: FONT.extrabold }

/** `tracking` en em (spec §3: -0.03em en títulos y números protagonistas). */
const texto = (fontSize: number, peso: Peso, lineHeight: number, tracking = 0): TextToken => ({
  fontFamily: FAMILIA_POR_PESO[peso],
  fontSize,
  fontWeight: String(peso) as TextStyle['fontWeight'],
  lineHeight,
  ...(tracking ? { letterSpacing: Math.round(fontSize * tracking * 100) / 100 } : null),
})

export const typeScale = {
  // Roles de la spec §3.
  tituloPantalla: texto(31, 800, 34, -0.03),
  numeroProtagonista: texto(39, 800, 42, -0.03), // con `importe` (cifras tabulares)
  tituloTarjeta: texto(26, 800, 30, -0.02),
  textoFila: texto(16, 800, 22),
  etiquetaChip: texto(12, 800, 16),
  // Escala existente: mismos nombres y tamaños, pesos Manrope (spec §3: 600 secundario, 800 títulos y filas).
  titulo: texto(20, 800, 28), // título de pantalla y totales (spec §3: 800)
  seccion: texto(18, 800, 24),
  cuerpo: texto(16, 600, 24),
  cuerpoDestacado: texto(16, 800, 24), // nombres e importes de fila
  secundario: texto(14, 600, 20),
  etiqueta: texto(12, 800, 16), // solo chips y barra inferior
  // Cifras y títulos grandes (hero de reportes, consola del chofer, login).
  seccionGrande: texto(19, 800, 26), // botones xl y opciones grandes
  consolaTexto: texto(21, 800, 28), // acciones y direcciones de la consola
  tituloGrande: texto(24, 800, 32), // título de hoja o paso
  destacado: texto(28, 800, 36), // importe grande
  consolaCifra: texto(30, 800, 36), // cifra de la parada
  cifraGrande: texto(32, 800, 40), // cifra del hero de inicio y saldo del cliente
  cifra: texto(36, 800, 44), // cifra hero (reportes)
  hero: texto(48, 800, 56), // marca en el login ancho
} as const

/**
 * Font scale cap for text inside fixed-height controls (Button, Fab, bars, Field...): the text follows
 * the system font size up to this multiplier so it is never clipped. Single source of every
 * `maxFontSizeMultiplier` in the app (forward-ui, references/mobile.md).
 */
export const maxFontScale = 1.3

/** Importes: cifras tabulares (alinear a la derecha en la pantalla). */
export const importe: TextStyle = { fontVariant: ['tabular-nums'] }

// ── Radios, espaciado y sombra (plan §7.1) ─────────────────────────────────

export const radii = {
  campo: 10, // campos y botones legados (--radius-md)
  tarjeta: 16, // legado (--radius-lg); en la spec equivale al bloque de cantidad
  hoja: 24, // legado (--radius-xl); la fila de la spec es 22-24
  pastilla: 9999, // chips y botones (spec: píldora)
  // Spec FWD §4
  tarjetaGrande: 30,
  tile: 28,
  fila: 22,
  cantidad: 16,
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

/** --shadow-md de la web: la sombra de lo que flota (hojas, FAB, tarjetas de acción). Claro: 0 4px 6px -1px / 0,1. Oscuro: 0 4px 8px -1px / 0,5. */
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

/** Sombra suave de las tarjetas de contenido (S2): separa la tarjeta blanca del fondo `bg` sin competir con `shadowMd`. */
export const shadowSm = {
  light: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  dark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 1,
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


/** `shadowSm` del esquema activo, para `...sombra` en las tarjetas de contenido. */
export function useSombraTarjeta() {
  return shadowSm[useIsDark() ? 'dark' : 'light']
}


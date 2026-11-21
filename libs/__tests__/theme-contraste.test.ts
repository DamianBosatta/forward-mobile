import { radii, themeColors, typeScale, useThemeStore, type ForwardColors } from '../theme'

// Contraste WCAG 2.x: (L1 + 0,05) / (L2 + 0,05) con luminancia relativa sRGB.
function luminancia(hex: string): number {
  const limpio = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) {
    throw new Error(`Color no opaco o inválido: ${hex}`)
  }
  const canales = [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

type Par = [nombre: string, texto: string, fondo: string]

function pares(c: ForwardColors): Par[] {
  const textos: [string, string][] = [
    ['text', c.text],
    ['textSecondary', c.textSecondary],
    ['textMuted', c.textMuted],
    ['textDisabled', c.textDisabled],
    ['brandInk', c.brandInk],
    ['primary', c.primary],
    ['accentText', c.accentText],
    ['danger', c.danger],
  ]
  const fondos: [string, string][] = [
    ['surface', c.surface],
    ['bg', c.bg],
  ]
  const lista: Par[] = []
  for (const [nt, t] of textos) {
    for (const [nf, f] of fondos) lista.push([`${nt} sobre ${nf}`, t, f])
  }
  // Button inactivo, placeholder y ayuda de Field, Segmented sin elegir, texto de Field sobre surface2.
  lista.push(['textSecondary sobre surface2', c.textSecondary, c.surface2])
  lista.push(['text sobre surface2', c.text, c.surface2])
  // Field con error: texto y borde en chip.anulado.text sobre ambos fondos del campo.
  lista.push(['chip anulado text sobre surface', c.chip?.anulado.text ?? '', c.surface])
  lista.push(['chip anulado text sobre surface2', c.chip?.anulado.text ?? '', c.surface2])
  // Spec FWD (00-spec.md, sección 2): sobre lime, teal y estados el texto va siempre en tinta; blanco solo sobre petróleo.
  lista.push(['ink sobre lime', c.ink, c.lime])
  lista.push(['ink sobre teal', c.ink, c.teal])
  lista.push(['ink sobre warning', c.onState, c.warning])
  lista.push(['ink sobre dangerFill', c.onState, c.dangerFill])
  lista.push(['primaryFg sobre primaryBg', c.primaryFg, c.primaryBg])
  lista.push(['onFab sobre fabBg', c.onFab, c.fabBg])
  lista.push(['brandInk sobre brandSoft', c.brandInk, c.brandSoft])
  lista.push(['text sobre brandSoft', c.text, c.brandSoft])
  lista.push(['text sobre surfaceAlt', c.text, c.surfaceAlt])
  lista.push(['textSecondary sobre surfaceAlt', c.textSecondary, c.surfaceAlt])
  lista.push(['onAction sobre action', c.onAction, c.action])
  lista.push(['onPrimary sobre primary', c.onPrimary, c.primary])
  lista.push(['onPrimary sobre primaryHover', c.onPrimary, c.primaryHover])
  lista.push(['onTopBar sobre topBar', c.onTopBar, c.topBar])
  lista.push(['onTopBarStrong sobre topBar', c.onTopBarStrong, c.topBar])
  // Receta FWD .round: íconos y texto de los botones del encabezado sobre surface.
  lista.push(['onTopBarStrong sobre surface (botón redondo)', c.onTopBarStrong, c.surface])
  lista.push(['onPanelOscuro sobre panelOscuro', c.onPanelOscuro, c.panelOscuro])
  lista.push(['onPanelOscuroStrong sobre panelOscuro', c.onPanelOscuroStrong, c.panelOscuro])
  lista.push(['onDangerStrong sobre dangerStrong', c.onDangerStrong, c.dangerStrong])
  lista.push(['blanco sobre dangerStrong', '#FFFFFF', c.dangerStrong])
  for (const [estado, chip] of Object.entries(c.chip ?? {})) {
    lista.push([`chip ${estado}`, chip.text, chip.bg])
    // Notice: el cuerpo usa `text` sobre el fondo del chip (el icono usa chip.text, ya cubierto arriba).
    lista.push([`text sobre chip ${estado}`, c.text, chip.bg])
  }
  // Chips FWD §5: relleno pleno con texto ink (pendiente: surfaceAlt con text).
  for (const [estado, chip] of Object.entries(c.chipFill)) lista.push([`chipFill ${estado}`, chip.text, chip.bg])
  return lista
}

describe.each(['light', 'dark'] as const)('tema %s: contraste de texto', (tema) => {
  const colores = themeColors[tema]

  it('declara los seis chips de estado', () => {
    expect(Object.keys(colores.chip ?? {}).sort()).toEqual(
      ['anulado', 'confirmado', 'enCurso', 'entregado', 'pendiente', 'porAutorizar'],
    )
  })

  it.each(pares(colores))('%s pasa 4,5:1', (_nombre, texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5)
  })
})

// WCAG 1.4.11: el contorno de un control (campo, casilla, switch apagado) se distingue con 3:1.
describe.each(['light', 'dark'] as const)('tema %s: bordes de controles', (tema) => {
  const colores = themeColors[tema]

  it.each([
    ['surface', colores.surface],
    ['bg', colores.bg],
  ])('borderStrong sobre %s pasa 3:1', (_nombre, fondo) => {
    expect(contraste(colores.borderStrong, fondo)).toBeGreaterThanOrEqual(3)
  })

  it('borderStrong es propio y más fuerte que border (separadores)', () => {
    expect(colores.borderStrong).not.toBe(colores.border)
    expect(contraste(colores.borderStrong, colores.surface)).toBeGreaterThan(contraste(colores.border, colores.surface))
  })

  it('glassBorder usa borderStrong', () => {
    expect(colores.glassBorder).toBe(colores.borderStrong)
  })
})

describe('fórmula de contraste', () => {
  it('reproduce los valores conocidos (negro/blanco 21:1, marca sobre blanco < 4,5)', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contraste('#00C29E', '#FFFFFF')).toBeLessThan(4.5)
  })
})

describe('modo del tema', () => {
  it('arranca en "Como el teléfono"', () => {
    expect(useThemeStore.getState().mode).toBe('system')
  })
})

describe('global.css (nativewind) usa los mismos valores que libs/theme.ts', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'global.css'), 'utf8')

  function variables(selector: string): Record<string, string> {
    const inicio = css.indexOf(`${selector} {`)
    const bloque = inicio < 0 ? '' : css.slice(inicio, css.indexOf('}', inicio))
    return Object.fromEntries(
      [...bloque.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]),
    )
  }

  it.each([
    ['light', ':root'],
    ['dark', '.dark'],
  ] as const)('tema %s', (tema, selector) => {
    const c = themeColors[tema]
    expect(variables(selector)).toEqual({
      'color-bg': c.bg,
      'color-surface': c.surface,
      'color-surface-2': c.surface2,
      'color-surface-3': c.surface3,
      'color-border': c.border,
      'color-border-strong': c.borderStrong,
      'color-text': c.text,
      'color-text-muted': c.textMuted,
      'color-text-disabled': c.textDisabled,
      'color-brand': c.brand,
      'color-lime': c.lime,
      'color-teal': c.teal,
      'color-ink': c.ink,
      'color-surface-alt': c.surfaceAlt,
      'color-accent-text': c.accentText,
      'color-primary-bg': c.primaryBg,
      'color-primary-fg': c.primaryFg,
      'color-fab-bg': c.fabBg,
      'color-danger': c.danger,
      'color-danger-fill': c.dangerFill,
      'color-warning': c.warning,
      'color-brand-ink': c.brandInk,
      'color-brand-soft': c.brandSoft,
      'color-action': c.action,
      'color-on-action': c.onAction,
      'color-danger-strong': c.dangerStrong,
      'color-top-bar': c.topBar,
      'color-on-top-bar': c.onTopBar,
    })
  })
})

// Valores aprobados por el dueño (docs/mobile/restyle-fwd/00-spec.md, secciones 2 y 4). Defienden la regla escrita.
describe('tokens FWD de la spec', () => {
  it.each(['light', 'dark'] as const)('la barra superior va sobre el fondo de la pantalla, sin franja oscura (receta .header) en el tema %s', (tema) => {
    const c = themeColors[tema]
    expect([c.topBar, c.onTopBar, c.onTopBarStrong, c.topBarBorder]).toEqual([c.bg, c.textSecondary, c.text, c.border])
  })
  it.each(['light', 'dark'] as const)('marca igual en el tema %s', (tema) => {
    const c = themeColors[tema]
    expect([c.lime, c.teal, c.ink]).toEqual(['#E0EB3C', '#00AB96', '#201E1E'])
    expect([c.warning, c.dangerFill, c.onState]).toEqual(['#FFB020', '#FF6B5E', '#201E1E'])
  })

  it('tema claro', () => {
    const c = themeColors.light
    expect([c.bg, c.surface, c.surfaceAlt, c.text, c.textMuted, c.border]).toEqual(
      ['#F1F2EE', '#FFFFFF', '#E2E3DE', '#201E1E', '#5A5757', '#E2E3DE'],
    )
    expect([c.accentText, c.primaryBg, c.primaryFg, c.fabBg]).toEqual(['#00796A', '#00796A', '#FFFFFF', '#E0EB3C'])
  })

  it('tema oscuro', () => {
    const c = themeColors.dark
    expect([c.bg, c.surface, c.surfaceAlt, c.text, c.textMuted, c.border]).toEqual(
      ['#141213', '#2A2728', '#3A3637', '#F5F5F1', '#B5B2B3', '#454142'],
    )
    expect([c.accentText, c.primaryBg, c.primaryFg, c.fabBg]).toEqual(['#E0EB3C', '#E0EB3C', '#201E1E', '#00AB96'])
  })

  it('success e info siguen como hoy (S5: la flecha de Tesorería conserva verde y rojo)', () => {
    for (const tema of ['light', 'dark'] as const) {
      expect(themeColors[tema].success).toBe('#21C45D')
      expect(themeColors[tema].info).toBe('#0DA2E7')
    }
  })

  it('el teal de marca nunca es color de texto', () => {
    for (const tema of ['light', 'dark'] as const) {
      const c = themeColors[tema]
      for (const texto of [c.text, c.textMuted, c.brandInk, c.primary, c.accentText, c.danger]) {
        expect(texto.toUpperCase()).not.toBe(c.teal)
      }
    }
  })

  it('los fondos de estado no son color de texto: danger legado se lee sobre surface y bg', () => {
    for (const tema of ['light', 'dark'] as const) {
      const c = themeColors[tema]
      expect(contraste(c.danger, c.surface)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(c.danger, c.bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('los radios son los de la spec (sección 4)', () => {
    expect([radii.tarjetaGrande, radii.tile, radii.fila, radii.cantidad, radii.pastilla]).toEqual([30, 28, 22, 16, 9999])
  })
})

describe('typeScale (spec FWD §3)', () => {
  it('titulo va en peso 800', () => {
    expect(typeScale.titulo).toMatchObject({ fontSize: 20, fontWeight: '800' })
  })
  it('el texto de chipFill es ink salvo en pendiente (text sobre surfaceAlt)', () => {
    for (const modo of ['light', 'dark'] as const) {
      const c = themeColors[modo]
      expect(c.chipFill.confirmado.text).toBe(c.ink)
      expect(c.chipFill.entregado.text).toBe(c.ink)
      expect(c.chipFill.porAutorizar.text).toBe(c.onState)
      expect(c.chipFill.anulado.text).toBe(c.onState)
      expect(c.chipFill.pendiente).toEqual({ bg: c.surfaceAlt, text: c.text })
    }
  })
})

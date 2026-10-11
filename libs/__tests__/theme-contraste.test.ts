import { themeColors, useThemeStore, type ForwardColors } from '../theme'

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
  ]
  const fondos: [string, string][] = [
    ['surface', c.surface],
    ['bg', c.bg],
  ]
  const lista: Par[] = []
  for (const [nt, t] of textos) {
    for (const [nf, f] of fondos) lista.push([`${nt} sobre ${nf}`, t, f])
  }
  lista.push(['onAction sobre action', c.onAction, c.action])
  lista.push(['onPrimary sobre primary', c.onPrimary, c.primary])
  lista.push(['onPrimary sobre primaryHover', c.onPrimary, c.primaryHover])
  lista.push(['onTopBar sobre topBar', c.onTopBar, c.topBar])
  lista.push(['onDangerStrong sobre dangerStrong', c.onDangerStrong, c.dangerStrong])
  lista.push(['blanco sobre dangerStrong', '#FFFFFF', c.dangerStrong])
  for (const [estado, chip] of Object.entries(c.chip ?? {})) {
    lista.push([`chip ${estado}`, chip.text, chip.bg])
  }
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

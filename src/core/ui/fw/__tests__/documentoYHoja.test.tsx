import React from 'react'
import { Text } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { BottomSheet, DocumentCard } from '../index2'

const mockUseResponsive = jest.fn()
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}))

const telefono = { width: 390, height: 844, isSmall: false, isMedium: true, isLarge: false, scale: (n: number) => n }
const tablet = { width: 834, height: 1194, isSmall: false, isMedium: false, isLarge: true, scale: (n: number) => n }

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity as 1).filter(Boolean))

beforeEach(() => {
  mockUseResponsive.mockReturnValue(telefono)
  useThemeStore.setState({ mode: 'light' })
})

const venta = {
  numero: 'A00418',
  vendedor: 'Emanuel Parraquini',
  direccion: 'Juan B. Justo 6376',
  nombre: 'Carlos',
  hora: '10:03',
  importe: 214560,
  chip: { estado: 'confirmado' as const, label: 'Confirmado' },
}

describe.each(['light', 'dark'] as const)('tema %s', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('DocumentCard se pinta sobre la superficie del tema', () => {
    render(<DocumentCard {...venta} onPress={() => {}} />)
    expect(flat(screen.getByRole('button').props.style).backgroundColor).toBe(c.surface)
  })

  it('BottomSheet se pinta sobre la superficie del tema', () => {
    render(
      <BottomSheet visible onClose={() => {}} accessibilityLabel="Hoja">
        <Text>Contenido</Text>
      </BottomSheet>,
    )
    expect(flat(screen.getByLabelText('Hoja').props.style).backgroundColor).toBe(c.surface)
  })

  it('el velo del BottomSheet usa el color veil del tema y es translúcido', () => {
    render(
      <BottomSheet visible onClose={() => {}} accessibilityLabel="Hoja">
        <Text>Contenido</Text>
      </BottomSheet>,
    )
    const velo = flat(screen.getByLabelText('Cerrar', { includeHiddenElements: true }).props.style).backgroundColor
    expect(velo).toBe(c.veil)
    const alfa = /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)$/.exec(velo)
    expect(alfa).not.toBeNull()
    expect(Number(alfa![1])).toBeLessThan(1)
  })
})

describe('DocumentCard', () => {
  it('muestra la dirección como título y el nombre en una línea aparte', () => {
    render(<DocumentCard {...venta} onPress={() => {}} />)
    expect(screen.getByText('Juan B. Justo 6376')).toBeTruthy()
    expect(screen.getByText('Carlos')).toBeTruthy()
    expect(screen.queryByText(/Justo 6376 · Carlos/)).toBeNull()
    expect(flat(screen.getByText('Juan B. Justo 6376').props.style).fontSize).toBe(16)
  })

  it('muestra número, iniciales del vendedor, importe formateado y el chip', () => {
    render(<DocumentCard {...venta} onPress={() => {}} />)
    expect(screen.getByText('A00418 · Emanuel Parraquini')).toBeTruthy()
    expect(screen.getByText('EP')).toBeTruthy()
    expect(screen.getByText('$ 214.560,00')).toBeTruthy()
    expect(screen.getByText('Confirmado')).toBeTruthy()
  })

  it('llama onPress al tocarla y se anuncia completa', () => {
    const onPress = jest.fn()
    render(<DocumentCard {...venta} onPress={onPress} />)
    const card = screen.getByRole('button', { name: /A00418.*Juan B\. Justo 6376.*Carlos.*Confirmado/ })
    fireEvent.press(card)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(flat(card.props.style).minHeight).toBeGreaterThanOrEqual(44)
  })
})

describe('BottomSheet', () => {
  const hoja = (visible: boolean, onClose = jest.fn()) => (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Elegir cliente">
      <Text>¿A quién le vendés?</Text>
    </BottomSheet>
  )

  it('abre, cierra con el velo y desaparece al cerrarse', () => {
    const onClose = jest.fn()
    const { rerender } = render(hoja(true, onClose))
    expect(screen.getByText('¿A quién le vendés?')).toBeTruthy()
    // El velo queda detrás del diálogo modal: el lector de pantalla no lo ve
    // (cierra con el gesto de escape), pero el dedo sí.
    fireEvent.press(screen.getByLabelText('Cerrar', { includeHiddenElements: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
    rerender(hoja(false, onClose))
    expect(screen.queryByText('¿A quién le vendés?')).toBeNull()
  })

  it('en teléfono es hoja inferior: radio 24 solo arriba y con manija', () => {
    render(hoja(true))
    const panel = flat(screen.getByLabelText('Elegir cliente').props.style)
    expect(panel).toMatchObject({ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0 })
    expect(screen.getByTestId('hoja-manija')).toBeTruthy()
  })

  it('en tablet (≥ 600) se muestra como diálogo centrado', () => {
    mockUseResponsive.mockReturnValue(tablet)
    render(hoja(true))
    const panel = screen.getByLabelText('Elegir cliente')
    expect(panel.props.role).toBe('dialog')
    expect(flat(panel.props.style)).toMatchObject({ borderRadius: 24, maxWidth: 600 })
    expect(screen.queryByTestId('hoja-manija')).toBeNull()
  })
})

import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { ConfirmModal } from '../ConfirmModal'

const fondoDe = (texto: string) => {
  let nodo = screen.getByText(texto).parent
  while (nodo && StyleSheet.flatten(nodo.props.style)?.backgroundColor === undefined) nodo = nodo.parent
  return nodo ? StyleSheet.flatten(nodo.props.style).backgroundColor : undefined
}

describe.each(['light', 'dark'] as const)('ConfirmModal con los colores del tema (%s)', (modo) => {
  const c = themeColors[modo]
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('la tarjeta va en la superficie, cancelar en superficie-2 y anular en el rojo de peligro del tema', () => {
    render(<ConfirmModal visible title="Anular pedido" message="No se puede deshacer." confirmLabel="Anular" onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(fondoDe('Anular pedido')).toBe(c.surface)
    expect(fondoDe('Cancelar')).toBe(c.surface2)
    expect(fondoDe('Anular')).toBe(c.dangerStrong)
    expect(StyleSheet.flatten(screen.getByText('Anular').props.style).color).toBe(c.onDangerStrong)
  })

  it.each(['success', 'warning', 'info'] as const)('la variante %s escribe el botón con onState (tinta) sobre su relleno', (variant) => {
    render(<ConfirmModal visible variant={variant} title="Listo" confirmLabel="Aceptar" onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByText('Aceptar').props.style).color).toBe(c.onState)
    expect(fondoDe('Aceptar')).toBe(c[variant])
  })
})

// Visual review MB-16: on tablet the dialog card does not stretch across the screen.
let mockAnchoPantalla = 1024
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockAnchoPantalla, height: 700, scale: 2, fontScale: 1 }),
}))

const tarjeta = (titulo: string) => {
  let nodo = screen.getByText(titulo).parent
  while (nodo && StyleSheet.flatten(nodo.props.style)?.borderRadius === undefined) nodo = nodo.parent
  return StyleSheet.flatten(nodo!.props.style)
}

describe.each(['light', 'dark'] as const)('ConfirmModal width (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))
  afterAll(() => useThemeStore.setState({ mode: 'system' }))

  it('tablet: the card is capped at 480 and centered', () => {
    mockAnchoPantalla = 1024
    render(<ConfirmModal visible title="Avisos" confirmLabel="Activar" onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(tarjeta('Avisos')).toMatchObject({ width: '100%', maxWidth: 480, alignSelf: 'center' })
  })

  it('phone: the card has no cap, as before', () => {
    mockAnchoPantalla = 390
    render(<ConfirmModal visible title="Avisos" confirmLabel="Activar" onConfirm={jest.fn()} onCancel={jest.fn()} />)
    const e = tarjeta('Avisos')
    expect(e.width).toBe('100%')
    expect(e.maxWidth).toBeUndefined()
    expect(e.alignSelf).toBeUndefined()
  })
})

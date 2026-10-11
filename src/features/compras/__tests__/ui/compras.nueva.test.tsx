import React from 'react'
import { render } from '@testing-library/react-native'
import NuevaCompraScreen from '../../../../../app/(tabs)/compras/nueva'

const mockRedirect = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  Redirect: (p: { href: string }) => { mockRedirect(p.href); return null },
}))
jest.mock('@/features/compras/components/CompraNueva', () => ({ CompraNueva: () => null }))

describe('ruta compras/nueva', () => {
  beforeEach(() => { jest.clearAllMocks(); mockParams = {} })

  it('un enlace viejo de edición vuelve al detalle: ya no hay un formulario que pierda datos', () => {
    mockParams = { edit: 'c1' }
    render(<NuevaCompraScreen />)
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)/compras/c1')
  })

  it('sin edición abre la compra nueva', () => {
    render(<NuevaCompraScreen />)
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

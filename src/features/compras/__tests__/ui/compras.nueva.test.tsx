import React from 'react'
import { render } from '@testing-library/react-native'
import NuevaCompraScreen from '../../../../../app/(tabs)/compras/nueva'

const mockCompraNueva = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }))
jest.mock('@/features/compras/components/CompraNueva', () => ({ CompraNueva: (p: unknown) => { mockCompraNueva(p); return null } }))

describe('ruta compras/nueva', () => {
  beforeEach(() => { jest.clearAllMocks(); mockParams = {} })

  it('con ?edit= abre el formulario nuevo en modo edición', () => {
    mockParams = { edit: 'c1' }
    render(<NuevaCompraScreen />)
    expect(mockCompraNueva).toHaveBeenCalledWith({ editarId: 'c1' })
  })

  it('con ?borrador= retoma el borrador', () => {
    mockParams = { borrador: 'b9' }
    render(<NuevaCompraScreen />)
    expect(mockCompraNueva).toHaveBeenCalledWith({ borradorId: 'b9' })
  })

  it('con ?proveedor= (desde la ficha del proveedor) lo preselecciona', () => {
    mockParams = { proveedor: 'p7' }
    render(<NuevaCompraScreen />)
    expect(mockCompraNueva).toHaveBeenCalledWith({ proveedorId: 'p7' })
  })

  it('sin parámetros abre la compra nueva', () => {
    render(<NuevaCompraScreen />)
    expect(mockCompraNueva).toHaveBeenCalledWith({ borradorId: undefined })
  })
})

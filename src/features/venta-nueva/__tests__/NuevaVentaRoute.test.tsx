import React from 'react'
import { act, render, screen } from '@testing-library/react-native'

import NuevaVentaRoute from '../../../../app/(tabs)/ventas/nueva'

let mockParams: Record<string, string> = {}
const mockSetParams = jest.fn()
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: (...a: unknown[]) => mockSetParams(...a) }),
}))

// La pantalla real es enorme: acá importa cuándo la ruta la descarta y abre una limpia.
let mockInstancias = 0
let mockTerminar: (() => void) | undefined
jest.mock('@/features/venta-nueva/components/VentaNuevaPantalla', () => {
  const R = require('react')
  const { Text: T } = require('react-native')
  return {
    VentaNuevaPantalla: ({ alTerminar }: { alTerminar?: () => void }) => {
      const [id] = R.useState(() => ++mockInstancias)
      mockTerminar = alTerminar
      return <T>{`pantalla ${id}`}</T>
    },
  }
})

beforeEach(() => { mockInstancias = 0; mockTerminar = undefined; mockParams = {}; mockSetParams.mockClear() })

describe('ruta de venta nueva: cada venta, una pantalla limpia', () => {
  it('después de grabar una venta, "Nueva venta" abre una pantalla nueva (no la vieja en Revisar)', () => {
    render(<NuevaVentaRoute />)
    expect(screen.getByText('pantalla 1')).toBeTruthy()
    act(() => { mockTerminar!() })
    expect(screen.getByText('pantalla 2')).toBeTruthy()
  })

  it('Duplicar otra venta (cambian los parámetros) abre una pantalla nueva', () => {
    mockParams = { duplicar: 'v1' }
    const { rerender } = render(<NuevaVentaRoute />)
    expect(screen.getByText('pantalla 1')).toBeTruthy()
    mockParams = { duplicar: 'v2' }
    rerender(<NuevaVentaRoute />)
    expect(screen.getByText('pantalla 2')).toBeTruthy()
  })

  it('con los mismos parámetros y sin grabar, la pantalla se conserva', () => {
    mockParams = { duplicar: 'v1' }
    const { rerender } = render(<NuevaVentaRoute />)
    rerender(<NuevaVentaRoute />)
    expect(screen.getByText('pantalla 1')).toBeTruthy()
  })

  it('al terminar se limpian los parámetros para que "Nueva venta" no reabra el duplicado', () => {
    mockParams = { duplicar: 'v1' }
    render(<NuevaVentaRoute />)
    act(() => { mockTerminar!() })
    expect(mockSetParams).toHaveBeenCalledWith({ borrador: undefined, tipo: undefined, editar: undefined, duplicar: undefined, clienteId: undefined })
  })
})

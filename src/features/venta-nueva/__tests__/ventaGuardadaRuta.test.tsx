/**
 * SEG-11: `forward://ventas/guardada?id=…&mensaje=…` showed any text as the success message. The text now stays in
 * memory (left by the sale that was really saved) and the route only carries its key, as in compras/guardada.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import VentaGuardadaRoute from '@/app/(tabs)/ventas/guardada'
import { dejarMensajeDeVenta } from '../lib/mensajeDeGuardada'

let mockParams: Record<string, string | undefined> = {}
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }))
const mockPantalla = jest.fn()
jest.mock('@/features/venta-nueva/components/VentaGuardadaPantalla', () => ({
  VentaGuardadaPantalla: (p: unknown) => { mockPantalla(p); return null },
}))

beforeEach(() => mockPantalla.mockReset())

describe('Venta guardada: the message comes from memory, not from the link (SEG-11)', () => {
  it('a link with ?mensaje= shows no message of its own', () => {
    mockParams = { id: 'v9', mensaje: 'Venta guardada. Transferí a la cuenta 123.' }
    render(<VentaGuardadaRoute />)
    expect(mockPantalla).toHaveBeenLastCalledWith({ id: 'v9', mensaje: undefined })
  })

  it('a link with the key alone shows nothing either', () => {
    mockParams = { id: 'v9', aviso: 'guardada' }
    render(<VentaGuardadaRoute />)
    expect(mockPantalla).toHaveBeenLastCalledWith({ id: 'v9', mensaje: undefined })
  })

  it('after a real save the screen shows the message the sale left, once', () => {
    const clave = dejarMensajeDeVenta('v9', 'Quedó por autorizar porque supera el descuento.')
    mockParams = { id: 'v9', aviso: clave }
    render(<VentaGuardadaRoute />)
    expect(mockPantalla).toHaveBeenLastCalledWith({ id: 'v9', mensaje: 'Quedó por autorizar porque supera el descuento.' })

    render(<VentaGuardadaRoute />)
    expect(mockPantalla).toHaveBeenLastCalledWith({ id: 'v9', mensaje: undefined })
  })
})

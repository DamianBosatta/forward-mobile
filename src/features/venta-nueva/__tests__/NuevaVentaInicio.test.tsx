import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { NuevaVentaInicio } from '../components/NuevaVentaInicio'

const jara = { id: 'c1', direccion: 'Jara 1643', nombreFantasia: 'Dietética' }
let mockUltimo: object | null = null
jest.mock('../hooks/useUltimoPedido', () => ({ useUltimoPedido: () => ({ ultimo: mockUltimo, cargando: false, error: false }) }))
jest.mock('../components/ElegirClienteVenta', () => ({
  ElegirClienteVenta: ({ onElegir, seleccionadoId }: { onElegir: (c: object) => void; seleccionadoId?: string }) => {
    const { Pressable, Text } = require('react-native')
    return <Pressable accessibilityRole="button" accessibilityLabel="Elegir Jara" onPress={() => onElegir(jara)}><Text>{seleccionadoId ?? 'nadie'}</Text></Pressable>
  },
}))

function abrir() {
  const onElegir = jest.fn()
  render(<NuevaVentaInicio tipo="Pedido" onTipo={jest.fn()} onElegir={onElegir} onNuevoCliente={jest.fn()} onVolver={jest.fn()} />)
  return onElegir
}
const continuar = () => screen.getByRole('button', { name: /^Continuar a productos/ })

describe('paso 1: elegir cliente y continuar', () => {
  beforeEach(() => { mockUltimo = null })

  it('elegir un cliente no arranca la venta: "Continuar a productos" está apagado hasta elegir y recién ahí la arranca', async () => {
    const onElegir = abrir()
    expect(continuar()).toBeDisabled()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Jara' }))
    expect(onElegir).not.toHaveBeenCalled()
    await userEvent.press(continuar())
    expect(onElegir).toHaveBeenCalledTimes(1)
    expect(onElegir).toHaveBeenCalledWith(jara)
  })

  it('sin pedido anterior no se ofrece repetirlo', async () => {
    abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Jara' }))
    expect(screen.queryByRole('button', { name: 'Repetir el último pedido' })).toBeNull()
  })

  it('con pedido anterior ofrece repetirlo', async () => {
    mockUltimo = { id: 'v1' }
    const onElegir = abrir()
    expect(screen.queryByRole('button', { name: 'Repetir el último pedido' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Jara' }))
    await userEvent.press(screen.getByRole('button', { name: 'Repetir el último pedido' }))
    expect(onElegir).toHaveBeenCalledWith(jara, { delUltimo: true })
  })

  it('el tipo Pedido va primero', () => {
    abrir()
    const radios = screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel ?? '')
    expect(radios.findIndex((l: string) => /Pedido/.test(l))).toBeLessThan(radios.findIndex((l: string) => /Presupuesto/.test(l)))
  })
})

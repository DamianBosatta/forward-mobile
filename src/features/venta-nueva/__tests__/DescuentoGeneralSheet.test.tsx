import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { DescuentoGeneralSheet } from '../components/DescuentoGeneralSheet'
import type { LineaCarrito } from '../lib/carrito'
import { producto } from '../__testing__/producto'

const linea = (over: Partial<LineaCarrito> = {}): LineaCarrito => ({ productoId: 'p1', producto: producto(), cantidad: 1, descuentoPct: 0, ...over })

beforeEach(() => useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [], maxDescuentoPorcentaje: 10 } as never }))

describe('R6 Descuento a toda la venta', () => {
  const lineas = [linea({ cantidad: 10 })]
  function abrirGeneral(valor = 0) {
    const onAplicar = jest.fn()
    render(<DescuentoGeneralSheet visible valor={valor} lineas={lineas} flete={3300} onClose={jest.fn()} onAplicar={onAplicar} />)
    return onAplicar
  }

  it('muestra cómo queda el total con el descuento y el flete, y aplica el elegido', async () => {
    const onAplicar = abrirGeneral()
    await userEvent.press(screen.getByRole('button', { name: '5 %' }))
    expect(screen.getByLabelText('Descuento 5 %: -$ 1.248,00')).toBeTruthy()
    expect(screen.getByLabelText('Total: $ 27.012,00')).toBeTruthy() // 10 × 2.496 − 5 % + flete 3.300
    await userEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(onAplicar).toHaveBeenCalledWith(5)
  })

  it('"Otro" acepta cualquier valor de 0 a 100 y avisa si pasa el tope', async () => {
    const onAplicar = abrirGeneral()
    await userEvent.press(screen.getByRole('button', { name: 'Otro porcentaje' }))
    await userEvent.type(screen.getByLabelText('Descuento general (%)'), '12')
    expect(screen.getByText('Supera tu tope de 10 %: el pedido queda por autorizar.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(onAplicar).toHaveBeenCalledWith(12)
  })

  it('un valor inválido no se aplica', async () => {
    abrirGeneral()
    await userEvent.press(screen.getByRole('button', { name: 'Otro porcentaje' }))
    await userEvent.type(screen.getByLabelText('Descuento general (%)'), '101')
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
  })

  it('arranca con el descuento vigente: uno fuera de las opciones abre "Otro" con su valor', () => {
    abrirGeneral(7)
    expect(screen.getByLabelText('Descuento general (%)').props.value).toBe('7')
  })
})

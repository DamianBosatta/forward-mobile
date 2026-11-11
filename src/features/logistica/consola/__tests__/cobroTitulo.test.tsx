import React from 'react'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { CobroEnEntrega } from '../CobroEnEntrega'

const props = { medios: [], mediosError: false, lineas: [], onLineas: jest.fn(), onSubiendo: jest.fn(), hoy: '07/11/2026' }

describe('CobroEnEntrega: encabezado y cuenta del cliente (S8)', () => {
  it('no repite "Cobro" ni "A cobrar hoy": el título es "¿Cómo paga?"', () => {
    render(<CobroEnEntrega {...props} aCobrar={500} />)
    expect(screen.queryByText('Cobro')).toBeNull()
    expect(screen.queryByLabelText('A cobrar hoy')).toBeNull()
    expect(screen.getByRole('header', { name: '¿Cómo paga?' })).toBeTruthy()
  })

  it('la factura lleva el número de la nota de pedido cuando lo hay', () => {
    render(<CobroEnEntrega {...props} aCobrar={500} codigoFactura="A00012" />)
    expect(within(screen.getByLabelText('Factura')).getByText('Factura A00012')).toBeTruthy()
    expect(within(screen.getByLabelText('Factura')).getByText('$ 500,00')).toBeTruthy()
  })

  it('"No paga" solo aparece si quien lo aloja sabe qué hacer con él', async () => {
    const onNoPaga = jest.fn()
    const { rerender } = render(<CobroEnEntrega {...props} />)
    expect(screen.queryByLabelText('No paga')).toBeNull()
    rerender(<CobroEnEntrega {...props} onNoPaga={onNoPaga} />)
    await userEvent.press(screen.getByLabelText('No paga'))
    expect(onNoPaga).toHaveBeenCalledTimes(1)
    expect(props.onLineas).not.toHaveBeenCalled()
  })
})

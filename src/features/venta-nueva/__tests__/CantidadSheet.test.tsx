import React from 'react'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CantidadSheet, opcionesDeDescuento } from '../components/CantidadSheet'
import { DescuentoGeneralSheet } from '../components/DescuentoGeneralSheet'
import { MENSAJE_TOPE_SIN_CONFIGURAR } from '../lib/linea'
import type { LineaCarrito } from '../lib/carrito'
import { cajaDe6, producto } from '../__testing__/producto'

const EXENTO = { module: 'CAP_EXENTO_TOPE_DESCUENTO', canRead: true }
const conUsuario = (maxDescuentoPorcentaje: number, permissions: object[] = []) =>
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions, maxDescuentoPorcentaje } as never })
const linea = (over: Partial<LineaCarrito> = {}): LineaCarrito => ({ productoId: 'p1', producto: producto(), cantidad: 1, descuentoPct: 0, ...over })

function abrir(l = linea()) {
  const onConfirm = jest.fn()
  const onQuitar = jest.fn()
  const onClose = jest.fn()
  render(<CantidadSheet linea={l} onClose={onClose} onConfirm={onConfirm} onQuitar={onQuitar} />)
  return { onConfirm, onQuitar, onClose }
}
const teclas = async (digitos: string) => { for (const d of digitos) await userEvent.press(screen.getByRole('button', { name: d })) }

beforeEach(() => conUsuario(10))

describe('V5 Cantidad y descuento: cierre y grilla de descuentos', () => {
  it('V5: la X "Cerrar" cierra la hoja sin confirmar ni quitar la línea', async () => {
    const { onClose, onConfirm, onQuitar } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onQuitar).not.toHaveBeenCalled()
  })

  it('V5: los descuentos van en una grilla de cuatro columnas, con los mismos valores', () => {
    abrir()
    const grilla = screen.getByTestId('cantidad-descuentos')
    const botones = within(grilla).getAllByRole('button')
    expect(botones.map((b) => b.props.accessibilityLabel)).toEqual(['0 %', '5 %', '10 %', 'Otro descuento'])
    botones.forEach((b) => expect(b).toHaveStyle({ width: '23%' }))
  })
})

describe('V5 Cantidad y descuento: el teclado', () => {
  it('se tipea la cantidad y el subtotal sale del precio del servidor', async () => {
    const { onConfirm } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Borrar todo' }))
    await teclas('12')
    expect(screen.getByLabelText('Cantidad: 12')).toBeTruthy()
    expect(screen.getByTestId('cantidad-subtotal')).toHaveTextContent('$ 29.952,00')
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 12, descuentoPct: 0 }))
  })

  it('V5: la cantidad se ve grande y las teclas son grandes (3 columnas, 12 teclas)', () => {
    abrir()
    expect(screen.getByLabelText('Cantidad: 1')).toHaveStyle({ fontSize: 40 })
    const teclado = screen.getByTestId('cantidad-teclado')
    expect(within(teclado).getAllByRole('button')).toHaveLength(12)
    expect(within(teclado).getByRole('button', { name: '5' })).toHaveStyle({ minHeight: 56 })
  })

  it('V5: con el teclado se arma 1204 y no deja pasar de cuatro dígitos; Listo confirma ese valor', async () => {
    const { onConfirm } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Borrar todo' }))
    await teclas('12045')
    expect(screen.getByLabelText('Cantidad: 1204')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 1204 }))
  })

  it('"Borrar" saca el último dígito', async () => {
    abrir(linea({ cantidad: 12 }))
    await userEvent.press(screen.getByRole('button', { name: 'Borrar' }))
    expect(screen.getByLabelText('Cantidad: 1')).toBeTruthy()
  })

  it('con cantidad cero no se puede seguir y dice por qué', async () => {
    abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Borrar todo' }))
    expect(screen.getByRole('button', { name: 'Listo' })).toBeDisabled()
    expect(screen.getByText('Poné al menos una unidad.')).toBeTruthy()
  })

  it('una caja de 6 va de a 6: otra cantidad se rechaza con el motivo y "Por caja" la corrige', async () => {
    const p = cajaDe6()
    const { onConfirm } = abrir({ productoId: p.id, producto: p, cantidad: 6, descuentoPct: 0 })
    await userEvent.press(screen.getByRole('button', { name: 'Borrar todo' }))
    await teclas('10')
    expect(screen.getByRole('button', { name: 'Listo' })).toBeDisabled()
    expect(screen.getByText('Se vende de a 6: probá con 6 o 12.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: '2 cajas, 12 unidades' }))
    expect(screen.getByLabelText('Cantidad: 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 12 }))
  })

  it('un producto por unidad no muestra "Por caja"', () => {
    abrir()
    expect(screen.queryByText('Por caja')).toBeNull()
  })

  it('"Quitar" saca la línea', async () => {
    const { onQuitar } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Quitar la línea' }))
    expect(onQuitar).toHaveBeenCalledWith('p1')
  })
})

describe('V5 Cantidad y descuento: el descuento y el tope', () => {
  it('ofrece 0 %, 5 % y el tope del vendedor; hasta el tope no avisa nada', async () => {
    const { onConfirm } = abrir()
    expect(screen.getByRole('button', { name: '0 %' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '5 %' })).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: '10 %' }))
    expect(screen.queryByText(/por autorizar/)).toBeNull()
    expect(screen.getByTestId('cantidad-subtotal')).toHaveTextContent('$ 2.246,40')
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ descuentoPct: 10 }))
  })

  it('un descuento mayor al tope avisa que el pedido queda por autorizar, con el tope del vendedor', async () => {
    abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Otro descuento' }))
    await userEvent.type(screen.getByLabelText('Descuento (%)'), '15')
    expect(screen.getByText('Supera tu tope de 10 %: el pedido queda por autorizar.')).toBeTruthy()
    // Se puede seguir: el servidor decide al guardar.
    expect(screen.getByRole('button', { name: 'Listo' })).toBeEnabled()
  })

  it('sin tope configurado cualquier descuento avisa con el mensaje del servidor (y no hay chips por encima de 0)', async () => {
    conUsuario(0)
    abrir()
    expect(screen.queryByRole('button', { name: '5 %' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Otro descuento' }))
    await userEvent.type(screen.getByLabelText('Descuento (%)'), '5')
    expect(screen.getByText(MENSAJE_TOPE_SIN_CONFIGURAR)).toBeTruthy()
  })

  it('un descuento fuera de 0 a 100 no se puede aplicar', async () => {
    abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Otro descuento' }))
    await userEvent.type(screen.getByLabelText('Descuento (%)'), '120')
    expect(screen.getByRole('button', { name: 'Listo' })).toBeDisabled()
  })

  it('las opciones: sin pasarse del tope, y quien está exento ve las comunes', () => {
    expect(opcionesDeDescuento(10)).toEqual([0, 5, 10])
    expect(opcionesDeDescuento(3)).toEqual([0, 3])
    expect(opcionesDeDescuento(0)).toEqual([0])
    expect(opcionesDeDescuento(0, true)).toEqual([0, 5])
  })

  it('exento sin tope: el 5 % se ofrece y no avisa', async () => {
    conUsuario(0, [EXENTO])
    abrir()
    await userEvent.press(screen.getByRole('button', { name: '5 %' }))
    expect(screen.queryByText(MENSAJE_TOPE_SIN_CONFIGURAR)).toBeNull()
  })
})

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

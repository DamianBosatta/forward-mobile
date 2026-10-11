import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { pctFromPrecio, precioFromPct } from '@/features/ventas/lib/descuentos'
import { EditarLineaSheet } from '../components/EditarLineaSheet'
import { leerNumero } from '../lib/linea'
import type { LineaCarrito } from '../lib/carrito'
import { cajaDe6, producto } from '../__testing__/producto'

const VER_COSTOS = { module: 'CAP_VER_COSTOS', canRead: true }
const EXENTO = { module: 'CAP_EXENTO_TOPE_DESCUENTO', canRead: true }
const conUsuario = (maxDescuentoPorcentaje: number, permissions: object[] = []) =>
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions, maxDescuentoPorcentaje } as never })

const linea = (over: Partial<LineaCarrito> = {}): LineaCarrito => {
  const p = producto({ precioCompraBase: 1410, costoDirecto: 1500, precioMinimoRentable: 2000 })
  return { productoId: p.id, producto: p, cantidad: 12, descuentoPct: 0, ...over }
}

function abrir(l = linea(), onConfirm = jest.fn()) {
  render(<EditarLineaSheet linea={l} onClose={jest.fn()} onConfirm={onConfirm} onQuitar={jest.fn()} />)
  return onConfirm
}
const escribir = async (campo: string, texto: string) => {
  const input = screen.getByLabelText(campo)
  await userEvent.clear(input)
  await userEvent.type(input, texto)
}
const valor = (campo: string) => leerNumero(screen.getByLabelText(campo).props.value)

beforeEach(() => conUsuario(10))

describe('EditarLineaSheet: descuento % ↔ precio con descuento (descuentos.ts)', () => {
  it('el % calcula el precio igual que precioFromPct', async () => {
    abrir()
    await escribir('Descuento (%)', '12,82')
    expect(valor('Precio con descuento ($)')).toBe(precioFromPct(2496, 12.82))
  })

  it('el precio calcula el % igual que pctFromPrecio', async () => {
    abrir()
    await escribir('Precio con descuento ($)', '2176')
    expect(valor('Descuento (%)')).toBe(pctFromPrecio(2496, 2176))
  })

  it('confirma con la cantidad y el % elegidos; el precio lo pone el servidor', async () => {
    const onConfirm = abrir()
    await escribir('Descuento (%)', '5')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 12, descuentoPct: 5 }))
  })
})

describe('EditarLineaSheet: múltiplo de la unidad de venta', () => {
  it('en caja de 6, + suma 6 y − no baja del mínimo', async () => {
    abrir({ ...linea(), productoId: 'p6', producto: cajaDe6(), cantidad: 6 })
    await userEvent.press(screen.getByRole('button', { name: 'Sumar' }))
    expect(screen.getByLabelText('Unidades: 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Restar' }))
    await userEvent.press(screen.getByRole('button', { name: 'Restar' }))
    expect(screen.getByLabelText('Unidades: 6')).toBeTruthy()
  })
})

describe('EditarLineaSheet: avisos', () => {
  it('pasarse del tope avisa que va a quedar por autorizar; dentro del tope, nada', async () => {
    abrir()
    await escribir('Descuento (%)', '8')
    expect(screen.queryByText(/Tu tope de descuento es 10 %/)).toBeNull()
    await escribir('Descuento (%)', '12,82')
    expect(screen.getByText(/Tu tope de descuento es 10 %/)).toBeTruthy()
    expect(screen.getByText(/va a quedar por autorizar/)).toBeTruthy()
  })

  it('sin tope configurado cualquier descuento rebota, salvo con la exención', async () => {
    conUsuario(0)
    abrir()
    await escribir('Descuento (%)', '1')
    expect(screen.getByText(/No tenés un límite de descuento configurado/)).toBeTruthy()
    screen.unmount()
    conUsuario(0, [EXENTO])
    abrir()
    await escribir('Descuento (%)', '1')
    expect(screen.queryByText(/No tenés un límite/)).toBeNull()
  })

  it('debajo del precio mínimo: amarillo; debajo del costo: rojo', async () => {
    conUsuario(50)
    abrir()
    await escribir('Descuento (%)', '25')
    expect(screen.getByText(/Debajo del precio mínimo/)).toBeTruthy()
    await escribir('Descuento (%)', '45')
    expect(screen.getByText(/Debajo del costo/)).toBeTruthy()
  })
})

describe('EditarLineaSheet: costos solo con CAP_VER_COSTOS', () => {
  it('sin la capacidad no se dibuja costo, margen ni su etiqueta', () => {
    abrir()
    expect(screen.queryByTestId('costos-linea')).toBeNull()
    expect(screen.queryByText(/Precio de compra|Margen/)).toBeNull()
  })

  it('con la capacidad ve el precio de compra y el margen de la línea', () => {
    conUsuario(10, [VER_COSTOS])
    abrir()
    expect(screen.getByText('Precio de compra')).toBeTruthy()
    expect(screen.getByText('$ 1.410,00')).toBeTruthy()
    expect(screen.getByText('43,51 % · en verde')).toBeTruthy()
  })
})

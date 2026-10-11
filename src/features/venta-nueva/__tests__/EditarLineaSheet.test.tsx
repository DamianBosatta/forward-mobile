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

describe('EditarLineaSheet: entradas inválidas (es-AR)', () => {
  const confirmar = () => screen.getByRole('button', { name: 'Confirmar' })

  it('leerNumero entiende el punto de miles y la coma decimal; lo mal formado es inválido', () => {
    expect(leerNumero('1.500')).toBe(1500)
    expect(leerNumero('2.176,50')).toBe(2176.5)
    expect(leerNumero('12,82')).toBe(12.82)
    expect(leerNumero('')).toBeNull()
    expect(leerNumero('abc')).toBeNull()
    expect(leerNumero('1,2,3')).toBeNull()
    expect(leerNumero('-5')).toBeNull()
  })

  it.each([
    ['12.345.678', 12345678],
    ['12.5', 12.5],
    ['2176.50', 2176.5],
    ['0.75', 0.75],
    ['12,5', 12.5],
    ['12,', 12],
    ['12.', 12],
    ['1.2.3,4.5', null],
    ['1.2.3', null],
    ['.5', null],
    [',', null],
    ['.', null],
  ])('leerNumero(%j) → %j (acepta punto decimal y separador final)', (texto, esperado) => {
    expect(leerNumero(texto)).toBe(esperado)
  })

  it('"1.500" en el precio es 1500, no 1,5', async () => {
    abrir({ ...linea(), producto: producto({ precioVenta: 2000 }) })
    await escribir('Precio con descuento ($)', '1.500')
    expect(valor('Descuento (%)')).toBe(25)
  })

  it('borrar el precio no manda 100 %: avisa y no deja confirmar', async () => {
    const onConfirm = abrir()
    await userEvent.clear(screen.getByLabelText('Precio con descuento ($)'))
    expect(screen.getByText(/Ingresá un precio entre/)).toBeTruthy()
    await userEvent.press(confirmar())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('un % mayor a 100 o negativo avisa y no deja confirmar', async () => {
    const onConfirm = abrir()
    await escribir('Descuento (%)', '150')
    expect(screen.getByText(/entre 0 y 100/)).toBeTruthy()
    await userEvent.press(confirmar())
    await escribir('Descuento (%)', '-5')
    expect(screen.getByText(/entre 0 y 100/)).toBeTruthy()
    await userEvent.press(confirmar())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('un precio mayor a la lista avisa y no deja confirmar; corregido, confirma', async () => {
    const onConfirm = abrir()
    await escribir('Precio con descuento ($)', '3000')
    expect(screen.getByText(/Ingresá un precio entre/)).toBeTruthy()
    await userEvent.press(confirmar())
    expect(onConfirm).not.toHaveBeenCalled()
    await escribir('Precio con descuento ($)', '2496')
    expect(screen.queryByText(/Ingresá un precio entre/)).toBeNull()
    await userEvent.press(confirmar())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ descuentoPct: 0 }))
  })

  it('arranca con los valores de la línea ya en el primer render', () => {
    abrir(linea({ descuentoPct: 10, cantidad: 12 }))
    expect(screen.getByLabelText('Descuento (%)').props.value).toBe('10')
    expect(screen.getByLabelText('Unidades: 12')).toBeTruthy()
  })

  it('si cambia el objeto de la línea con la hoja abierta, no pisa lo que se tipeó', async () => {
    const l = linea()
    const props = { onClose: jest.fn(), onConfirm: jest.fn(), onQuitar: jest.fn() }
    const { rerender } = render(<EditarLineaSheet linea={l} {...props} />)
    await escribir('Descuento (%)', '7')
    rerender(<EditarLineaSheet linea={{ ...l }} {...props} />)
    expect(screen.getByLabelText('Descuento (%)').props.value).toBe('7')
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

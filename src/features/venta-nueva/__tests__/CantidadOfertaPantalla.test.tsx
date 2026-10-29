import React from 'react'
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CantidadOfertaPantalla } from '../components/CantidadOfertaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { cajaDe6, producto } from '../__testing__/producto'
import type { CatalogoStockItem } from '@/libs/api-client'
import type { LineaCarrito } from '../lib/carrito'

const VER_STOCK = { module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }
const VER_COSTOS = { module: 'CAP_VER_COSTOS', canRead: true }
const conUsuario = (maxDescuentoPorcentaje: number, permissions: object[] = []) =>
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions, maxDescuentoPorcentaje } as never })

const bulto10 = (over: Partial<CatalogoStockItem> = {}) => producto({ marca: 'Maxi Bag', bultoContenido: 10, disponible: 18, ...over })

function abrir(p: CatalogoStockItem = bulto10(), extra: { linea?: LineaCarrito; enVivo?: boolean } = {}) {
  const onListo = jest.fn()
  const onClose = jest.fn()
  render(<CantidadOfertaPantalla visible producto={p} linea={extra.linea} enVivo={extra.enVivo} onClose={onClose} onListo={onListo} />)
  return { onListo, onClose }
}
const escribir = (campo: string, texto: string) => fireEvent.changeText(screen.getByLabelText(campo), texto)
const valorCampo = (campo: string) => screen.getByLabelText(campo).props.value
const listo = () => screen.getByRole('button', { name: 'Listo, seguir cargando' })

beforeEach(() => {
  conUsuario(15, [VER_STOCK])
  useCarritoVenta.setState({ lineas: [] })
})

describe('Cantidad y oferta: producto y cabecera', () => {
  it('muestra marca · código, nombre y la presentación con el precio de lista', () => {
    abrir()
    expect(screen.getByText('Maxi Bag · PRO11923')).toBeTruthy()
    expect(screen.getByText('Pala c/Cabo Fija LP')).toBeTruthy()
    expect(screen.getByText('Bulto x 10 u · lista $ 2.496,00')).toBeTruthy()
    expect(screen.getByText('Cantidad y oferta')).toBeTruthy()
  })

  it('"Volver" cierra sin tocar el carrito', async () => {
    const { onClose } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(useCarritoVenta.getState().lineas).toEqual([])
  })

  it('en un producto nuevo no hay tacho de quitar', () => {
    abrir()
    expect(screen.queryByRole('button', { name: 'Quitar la línea' })).toBeNull()
  })

  it('en una línea que ya está, el tacho la saca del carrito y cierra', async () => {
    const p = bulto10()
    const linea = { productoId: p.id, producto: p, cantidad: 20, descuentoPct: 0 }
    useCarritoVenta.setState({ lineas: [linea] })
    const { onClose } = abrir(p, { linea })
    await userEvent.press(screen.getByRole('button', { name: 'Quitar la línea' }))
    expect(useCarritoVenta.getState().lineas).toEqual([])
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Cantidad y oferta: Bultos / Unidades (decisión L4)', () => {
  it('un producto que se vende solo por caja ofrece solo Bultos', () => {
    abrir(cajaDe6({ disponible: 100 }))
    expect(screen.queryByRole('button', { name: 'Unidades' })).toBeNull()
    expect(screen.getByText('6 unidades en total')).toBeTruthy()
  })

  it('Bultos × N se guarda en unidades en el carrito', async () => {
    const { onListo } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Bultos' }))
    expect(screen.getByText('10 unidades en total')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Uno más' }))
    await userEvent.press(screen.getByRole('button', { name: 'Uno más' }))
    expect(screen.getByText('30 unidades en total')).toBeTruthy()
    await userEvent.press(listo())
    expect(useCarritoVenta.getState().lineas).toEqual([expect.objectContaining({ productoId: 'p1', cantidad: 30, descuentoPct: 0 })])
    expect(onListo).toHaveBeenCalledTimes(1)
  })

  it('en Unidades se puede pedir de a una y volver a Bultos redondea al bulto cerrado', async () => {
    abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Uno más' }))
    expect(screen.getByText('2 unidades en total')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Bultos' }))
    expect(screen.getByText('10 unidades en total')).toBeTruthy()
  })

  it('no baja de lo mínimo: para sacar la línea está el tacho', async () => {
    abrir(cajaDe6({ disponible: 100 }))
    await userEvent.press(screen.getByRole('button', { name: 'Uno menos' }))
    expect(screen.getByText('6 unidades en total')).toBeTruthy()
  })

  it('la cantidad tipeada tiene tope de dígitos (como el teclado): no acepta 123456', () => {
    abrir()
    escribir('Cantidad', '123456')
    expect(valorCampo('Cantidad')).toBe('1234')
  })

  it('se puede tipear la cantidad', () => {
    abrir()
    escribir('Cantidad', '25')
    expect(screen.getByText('25 unidades en total')).toBeTruthy()
  })
})

describe('Cantidad y oferta: stock en vivo y más de lo disponible (S6, S7)', () => {
  it('muestra Disponible, Te quedan y el indicador En vivo', async () => {
    abrir(bulto10({ disponible: 18 }), { enVivo: true })
    await userEvent.press(screen.getByRole('button', { name: 'Bultos' }))
    expect(screen.getByLabelText('Disponible: 18')).toBeTruthy()
    expect(screen.getByLabelText('Te quedan: 8')).toBeTruthy()
    expect(screen.getByText('En vivo')).toBeTruthy()
  })

  it('sin conexión en vivo lo dice', () => {
    abrir(bulto10(), { enVivo: false })
    expect(screen.getByText('Sin conexión')).toBeTruthy()
  })

  it('si pide más de lo disponible avisa que va a autorización, "Te quedan" es negativo y no bloquea', async () => {
    abrir(bulto10({ disponible: 5 }))
    await userEvent.press(screen.getByRole('button', { name: 'Bultos' }))
    expect(screen.getByText('Pediste más de lo disponible: la venta va a autorización')).toBeTruthy()
    expect(screen.getByLabelText('Te quedan: -5')).toBeTruthy()
    expect(listo()).toBeEnabled()
  })

  it('sin pedir de más no hay advertencia', () => {
    abrir(bulto10({ disponible: 18 }))
    expect(screen.queryByText(/Pediste más de lo disponible/)).toBeNull()
  })

  it('quien no ve cantidades de stock no ve números ni advertencia por números (el servidor manda disponible 0)', async () => {
    conUsuario(15, [])
    abrir(bulto10({ disponible: 0, puedeVenderse: true }))
    await userEvent.press(screen.getByRole('button', { name: 'Bultos' }))
    expect(screen.getByText('Hay stock')).toBeTruthy()
    expect(screen.queryByText('Disponible')).toBeNull()
    expect(screen.queryByText('Te quedan')).toBeNull()
    expect(screen.queryByText(/Pediste más de lo disponible/)).toBeNull()
  })

  it('quien no ve cantidades y el producto no se puede vender avisa que va a autorización', () => {
    conUsuario(15, [])
    abrir(bulto10({ disponible: 0, puedeVenderse: false }))
    expect(screen.getByText('Sin stock')).toBeTruthy()
    expect(screen.getByText('Pediste más de lo disponible: la venta va a autorización')).toBeTruthy()
  })
})

describe('Cantidad y oferta: descuento y precio con descuento', () => {
  it('el descuento % calcula el precio con descuento', () => {
    abrir()
    escribir('Descuento (%)', '10')
    expect(valorCampo('Precio con descuento ($)')).toBe('2246,4')
  })

  it('el precio con descuento calcula el descuento %', () => {
    abrir()
    escribir('Precio con descuento ($)', '2246,4')
    expect(valorCampo('Descuento (%)')).toBe('10')
  })

  it('un chip fija el descuento y el subtotal sale de unidades × precio con descuento', async () => {
    abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Bultos' }))
    await userEvent.press(screen.getByRole('button', { name: '10 %' }))
    expect(valorCampo('Precio con descuento ($)')).toBe('2246,4')
    expect(screen.getByTestId('oferta-subtotal')).toHaveTextContent('$ 22.464,00')
  })

  it('los chips llegan hasta el tope del vendedor', () => {
    conUsuario(10, [VER_STOCK])
    abrir()
    expect(screen.getByRole('button', { name: '10 %' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '15 %' })).toBeNull()
  })

  it('pasarse del tope no bloquea: avisa que queda por autorizar', () => {
    conUsuario(10, [VER_STOCK])
    abrir()
    escribir('Descuento (%)', '12')
    expect(screen.getByText('Supera tu tope de 10 %: el pedido queda por autorizar.')).toBeTruthy()
    expect(listo()).toBeEnabled()
  })

  it('un descuento mal escrito bloquea el Listo', () => {
    abrir()
    escribir('Descuento (%)', '150')
    expect(listo()).toBeDisabled()
  })

  it('Listo guarda el descuento en el carrito', async () => {
    abrir()
    await userEvent.press(screen.getByRole('button', { name: '5 %' }))
    await userEvent.press(listo())
    expect(useCarritoVenta.getState().lineas).toEqual([expect.objectContaining({ cantidad: 1, descuentoPct: 5 })])
  })

  it('editar una línea que ya está reemplaza la cantidad y no la duplica', async () => {
    const p = bulto10()
    const linea = { productoId: p.id, producto: p, cantidad: 20, descuentoPct: 5 }
    useCarritoVenta.setState({ lineas: [linea] })
    abrir(p, { linea })
    expect(screen.getByText('20 unidades en total')).toBeTruthy()
    expect(valorCampo('Descuento (%)')).toBe('5')
    await userEvent.press(screen.getByRole('button', { name: 'Uno más' }))
    await userEvent.press(listo())
    expect(useCarritoVenta.getState().lineas).toEqual([expect.objectContaining({ cantidad: 30, descuentoPct: 5 })])
  })
})

describe('Cantidad y oferta: costo solo con CAP_VER_COSTOS', () => {
  it('sin la capacidad no se dibuja el costo', () => {
    abrir(bulto10({ precioCompraBase: 1410 }))
    expect(screen.queryByTestId('oferta-costos')).toBeNull()
  })

  it('con la capacidad se ve el precio de compra', () => {
    conUsuario(15, [VER_STOCK, VER_COSTOS])
    abrir(bulto10({ precioCompraBase: 1410 }))
    expect(screen.getByTestId('oferta-costos')).toHaveTextContent(/\$ 1\.410,00/)
  })
})

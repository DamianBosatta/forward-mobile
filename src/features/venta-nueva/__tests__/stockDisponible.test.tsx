import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ProductoCatalogoCard } from '../components/ProductoCatalogoCard'
import { EditarLineaSheet } from '../components/EditarLineaSheet'
import { avisosVenta } from '../lib/avisos'
import { conStockFresco } from '../lib/avisoStockVivo'
import type { LineaCarrito } from '../lib/carrito'
import { producto } from '../__testing__/producto'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn().mockResolvedValue(undefined), post: jest.fn().mockResolvedValue(undefined) },
}))

// CODING-STANDARDS: el disponible sale del campo `disponible` de la API (real - reservado ya descontado), no de `real`.
const noop = () => {}
const linea = (cantidad: number, over = {}): LineaCarrito => {
  const p = producto({ real: 100, reservado: 98, disponible: 2, ...over })
  return { productoId: p.id, producto: p, cantidad, descuentoPct: 0 }
}
const ctx = { tipo: 'Pedido' as const, tope: 10, exento: false, descuentoGeneral: 0 }

describe('stock disponible de la venta (S6, S7)', () => {
  it('la tarjeta del catálogo muestra el disponible, no el real', () => {
    render(<ProductoCatalogoCard producto={producto({ real: 100, disponible: 2 })} cantidad={0} verCantidades onAgregar={noop} onSumar={noop} onRestar={noop} />)
    expect(screen.getByText('Quedan 2 u')).toBeTruthy()
  })

  it('pedir más que el disponible (aunque el real alcance) avisa que queda por autorizar, sin rechazar', () => {
    const r = avisosVenta([linea(5)], ctx)
    expect(r.porAutorizar).toContain('falta stock')
    expect(r.rechazos).toEqual([])
  })

  it('pedir hasta el disponible no avisa falta de stock', () => {
    expect(avisosVenta([linea(2)], ctx).porAutorizar).not.toContain('falta stock')
  })

  it('el editor de línea compara la cantidad con el disponible', () => {
    useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }], maxDescuentoPorcentaje: 10 } as never })
    const qc = new QueryClient()
    render(<QueryClientProvider client={qc}><EditarLineaSheet linea={linea(5)} onClose={noop} onConfirm={noop} onQuitar={noop} /></QueryClientProvider>)
    expect(screen.getByText('No alcanza')).toBeTruthy()
  })
})

describe('conStockFresco: la línea ve el stock del catálogo vivo, el precio queda como se cargó', () => {
  it('pone el stock nuevo del catálogo en el producto de la línea y no toca el precio', () => {
    const l = linea(5, { precioVenta: 1000 })
    const fresco = producto({ id: l.productoId, precioVenta: 1500, real: 100, reservado: 100, disponible: 0, puedeVenderse: false })
    const [r] = conStockFresco([l], [fresco])
    expect(r.producto.disponible).toBe(0)
    expect(r.producto.puedeVenderse).toBe(false)
    expect(r.producto.precioVenta).toBe(1000)
  })

  it('una línea cuyo producto no está en el catálogo queda igual', () => {
    const l = linea(5)
    expect(conStockFresco([l], [])[0]).toBe(l)
  })

  it('si nada cambió devuelve las mismas líneas', () => {
    const l = linea(5)
    const lineas = [l]
    expect(conStockFresco(lineas, [l.producto])).toBe(lineas)
  })
})

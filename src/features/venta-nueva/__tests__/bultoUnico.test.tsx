import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CLAVE_CATALOGO } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { ProductoCatalogoCard } from '../components/ProductoCatalogoCard'
import { RevisarVenta } from '../components/RevisarVenta'
import { CantidadOfertaPantalla } from '../components/CantidadOfertaPantalla'
import { cantidadEnPresentacion, resumenCarrito } from '../lib/carrito'
import { producto } from '../__testing__/producto'

// X1: una sola definición de "bulto". Bulto de 12 con venta mínima de 6 (se puede pedir de a 6): el bulto que se
// muestra y con el que se calcula el precio es el mismo en la pastilla, la tarjeta, el resumen, la revisión y la oferta.
const bulto12 = () => producto({ id: 'p12', nombre: 'Esponja x12', precioVenta: 100, bultoContenido: 12, ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Unidad', disponible: 100 })
const noop = () => {}

describe('una sola definición de bulto (bulto 12, venta mínima 6)', () => {
  it('tarjeta: la pastilla dice 12 u y el precio por bulto es de 12 unidades', () => {
    render(<ProductoCatalogoCard producto={bulto12()} cantidad={0} verCantidades onAbrirOferta={noop} />)
    expect(screen.getByText('Bulto x 12 u')).toBeTruthy()
    expect(screen.getByText('$ 1.200,00')).toBeTruthy()
    expect(screen.getByText('$ 100,00 por unidad')).toBeTruthy()
  })

  it('tarjeta con 12 u en el carrito: "1 bulto"; con 6 u: "6 u" (no es un bulto cerrado)', () => {
    expect(cantidadEnPresentacion(bulto12(), 12)).toBe('1 bulto')
    expect(cantidadEnPresentacion(bulto12(), 6)).toBe('6 u')
  })

  it('resumen del carrito cuenta bultos de 12 y deja lo demás en unidades', () => {
    const p = bulto12()
    expect(resumenCarrito([{ productoId: p.id, producto: p, cantidad: 24, descuentoPct: 0 }])).toBe('1 producto · 2 bultos')
    expect(resumenCarrito([{ productoId: p.id, producto: p, cantidad: 6, descuentoPct: 0 }])).toBe('1 producto · 6 u')
  })

  it('revisión: 12 u se leen como 1 bulto × precio de 12; 6 u como unidades', () => {
    const p = bulto12()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(CLAVE_CATALOGO, { items: [p], truncado: false })
    qc.setQueryDefaults(CLAVE_CATALOGO, { queryFn: async () => ({ items: [p], truncado: false }) })
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
    useCarritoVenta.setState({ lineas: [{ productoId: p.id, producto: p, cantidad: 12, descuentoPct: 0 }] })
    render(
      <QueryClientProvider client={qc}>
        <RevisarVenta cliente={null} descuentoGeneral={0} enviando={false} error={null} onConfirmar={noop} onEditarLinea={noop} />
      </QueryClientProvider>,
    )
    expect(screen.getByText('1 bulto × $ 1.200,00')).toBeTruthy()
  })

  it('oferta: el encabezado dice el mismo bulto que la pastilla', () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
    render(<CantidadOfertaPantalla visible producto={bulto12()} onClose={noop} />)
    expect(screen.getByText(/^Bulto x 12 u · lista/)).toBeTruthy()
  })
})

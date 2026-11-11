import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CantidadCostoPantalla } from '../../components/CantidadCostoPantalla'
import type { LineaCompra } from '../../lib/lineaCompra'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))

const LINEA: LineaCompra = { productoId: 'pr1', nombre: 'Balde Nuvia 10L', cantidad: 4, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: null }

function abrir(ficha: Record<string, unknown>, linea: LineaCompra = LINEA) {
  mockGet.mockResolvedValue({ id: 'pr1', codigoPropio: 'PROBL912', marca: 'Nuvia', bultoContenido: 12, bultoMadreContenido: 4, ...ficha })
  const onListo = jest.fn()
  const onQuitar = jest.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CantidadCostoPantalla linea={linea} onClose={jest.fn()} onListo={onListo} onQuitar={onQuitar} /></QueryClientProvider>)
  return { onListo, onQuitar }
}

const costo = () => screen.getByLabelText('Costo por unidad ($)')
const listo = () => screen.getByRole('button', { name: 'Listo, seguir cargando' })

describe('Cantidad y costo (frames 7 a 9)', () => {
  it('es una pantalla "Cantidad y costo" con la marca y el código del producto, y el tacho quita la línea', async () => {
    const { onQuitar } = abrir({ precioCompraBase: 1000 })
    expect(screen.getByText('Cantidad y costo')).toBeTruthy()
    expect(await screen.findByText('NUVIA · PROBL912')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Quitar la línea' }))
    expect(onQuitar).toHaveBeenCalledWith('pr1')
  })

  it.each([
    ['1.150,50', 1150.5],
    ['12,82', 12.82],
    ['12.5', 12.5],
  ])('el costo acepta decimales es-AR: "%s" es %d', async (tipeado, valor) => {
    const { onListo } = abrir({ precioCompraBase: null })
    await userEvent.type(costo(), tipeado)
    await userEvent.press(listo())
    expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ costoUnitario: valor }))
  })

  it('por bulto: la cantidad va en bultos, muestra las unidades y el costo sigue siendo por unidad', async () => {
    const { onListo } = abrir({ precioCompraBase: 1000 })
    await userEvent.press(await screen.findByRole('radio', { name: 'Bulto × 12' }))
    expect(screen.getByText('= 48 unidades')).toBeTruthy()
    // El bulto madre cuenta bultos: 4 bultos de 12 son 48 unidades.
    expect(screen.getByRole('radio', { name: 'Bulto madre × 48' })).toBeTruthy()
    await userEvent.type(costo(), '1000')
    // El pie dice cuántos bultos y a cuánto sale cada uno, y el subtotal.
    expect(screen.getByText('4 × $ 12.000,00')).toBeTruthy()
    expect(screen.getByText('$ 48.000,00')).toBeTruthy()
    await userEvent.press(listo())
    expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ unidad: 'Bulto', cantidad: 4, unidadesPorUnidad: 12, costoUnitario: 1000 }))
  })

  it('con pack no hay nivel Pack: Unidad va de a 8, Bulto y Bulto madre solo si son múltiplo', async () => {
    const { onListo } = abrir({ precioCompraBase: 1000, ventaMinimaUnidades: 8, bultoContenido: 288, bultoMadreContenido: 10 }, { ...LINEA, cantidad: 16 })
    expect(await screen.findByRole('radio', { name: 'Bulto × 288' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /^Pack/ })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Bulto madre × 2880' })).toBeTruthy()
    await userEvent.press(screen.getByRole('radio', { name: 'Unidad' }))
    await userEvent.type(costo(), '1000')
    await userEvent.press(listo())
    expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ unidad: 'Unidad', cantidad: 16, unidadesPorUnidad: 1, costoUnitario: 1000 }))
  })

  it('con pack de 8, 14 unidades no se pueden cargar: dice de a cuánto y el "+" suma de a 8', async () => {
    const { onListo } = abrir({ precioCompraBase: 1000, ventaMinimaUnidades: 8, bultoContenido: 12 }, { ...LINEA, cantidad: 14, costoUnitario: 600 })
    expect(await screen.findByText('Este producto se compra de a 8 unidades: 8, 16, 24…')).toBeTruthy()
    expect(listo()).toBeDisabled()
    await userEvent.press(listo())
    expect(onListo).not.toHaveBeenCalled()
    await userEvent.press(screen.getByRole('button', { name: 'Sumar' }))
    expect(screen.getByLabelText('Unidades').props.value).toBe('16')
    expect(listo()).toBeEnabled()
  })

  it('un solo nivel: el producto se compra solo por unidad', async () => {
    abrir({ precioCompraBase: 1000, ventaMinimaUnidades: 1, bultoContenido: 1, bultoMadreContenido: null })
    expect(await screen.findByRole('radio', { name: 'Unidad' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /^Bulto/ })).toBeNull()
  })

  it('no se compra una fracción de bulto', async () => {
    abrir({ precioCompraBase: 1000 })
    await userEvent.press(await screen.findByRole('radio', { name: 'Bulto × 12' }))
    await userEvent.type(costo(), '1000')
    await userEvent.clear(screen.getByLabelText('Bultos'))
    await userEvent.type(screen.getByLabelText('Bultos'), '2,5')
    expect(screen.getByText('Se compran bultos enteros: escribí un número sin decimales.')).toBeTruthy()
    expect(listo()).toBeDisabled()
  })

  it('un costo en 0 es inválido: lo explica y no deja seguir', async () => {
    abrir({ precioCompraBase: 1000 })
    await userEvent.type(costo(), '0')
    expect(screen.getByText('Escribí un costo mayor a 0, por ejemplo 1.150,50.')).toBeTruthy()
    expect(listo()).toBeDisabled()
  })

  it('avisa cuánto cambia el costo respecto del último, y más fuerte sobre el 50 %', async () => {
    abrir({ precioCompraBase: 1000 })
    await waitFor(() => expect(screen.getByText(/Último costo: \$ 1\.000,00/)).toBeTruthy())
    await userEvent.type(costo(), '1600')
    expect(screen.getByText(/Costo \+60 % sobre la última compra \(\$ 1\.000,00\)/)).toBeTruthy()
    expect(screen.getByText(/Cambia más del 50 %: revisalo/)).toBeTruthy()
    await userEvent.clear(costo())
    await userEvent.type(costo(), '1100')
    expect(screen.getByText('Sube 10 % respecto del último costo.')).toBeTruthy()
    expect(screen.queryByText(/Cambia más del 50 %/)).toBeNull()
    await userEvent.clear(costo())
    await userEvent.type(costo(), '900')
    expect(screen.getByText('Baja 10 % respecto del último costo.')).toBeTruthy()
  })

  it('sin costo no se sigue y no se inventa uno: aviso rojo y "Sin costo" en el pie', async () => {
    abrir({ precioCompraBase: null })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Productos/pr1'))
    expect(costo().props.value).toBe('')
    expect(screen.getByText(/Sin costo no se puede confirmar la compra\. El sistema nunca lo inventa\./)).toBeTruthy()
    expect(screen.getByText('Sin costo')).toBeTruthy()
    expect(listo()).toBeDisabled()
    await userEvent.type(costo(), '5000')
    expect(screen.queryByText(/respecto del último costo/)).toBeNull()
    expect(screen.queryByText(/Último costo/)).toBeNull()
  })

  it('abrir una línea y seguir sin tocar nada conserva la cantidad y el costo exactos', async () => {
    const { onListo } = abrir({ precioCompraBase: null }, { ...LINEA, cantidad: 2.345, costoUnitario: 12.345 })
    await userEvent.press(listo())
    expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 2.345, costoUnitario: 12.345 }))
  })
})

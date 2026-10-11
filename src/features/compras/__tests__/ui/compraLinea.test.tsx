import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraLineaSheet } from '../../components/CompraLineaSheet'
import type { LineaCompra } from '../../lib/lineaCompra'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const LINEA: LineaCompra = { productoId: 'pr1', nombre: 'Balde Nuvia 10L', cantidad: 4, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: null }

function abrir(ficha: Record<string, unknown>, linea: LineaCompra = LINEA) {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  mockGet.mockResolvedValue({ id: 'pr1', codigoPropio: 'PROBL912', bultoContenido: 12, bultoMadreContenido: 4, ...ficha })
  const onConfirm = jest.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CompraLineaSheet linea={linea} onClose={jest.fn()} onConfirm={onConfirm} onQuitar={jest.fn()} /></QueryClientProvider>)
  return onConfirm
}

const costo = () => screen.getByLabelText('Costo por unidad ($)')
const confirmar = () => screen.getByRole('button', { name: 'Confirmar' })

describe('línea de compra', () => {
  it.each([
    ['1.150,50', 1150.5],
    ['12,82', 12.82],
    ['12.5', 12.5],
  ])('el costo acepta decimales es-AR: "%s" es %d', async (tipeado, valor) => {
    const onConfirm = abrir({ precioCompraBase: null })
    await userEvent.type(costo(), tipeado)
    await userEvent.press(confirmar())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ costoUnitario: valor }))
  })

  it('por bulto: la cantidad va en bultos, muestra las unidades y el costo sigue siendo por unidad', async () => {
    const onConfirm = abrir({ precioCompraBase: 1000 })
    await userEvent.press(await screen.findByRole('radio', { name: 'Bulto × 12' }))
    expect(screen.getByText('= 48 unidades')).toBeTruthy()
    // El bulto madre cuenta bultos: 4 bultos de 12 son 48 unidades.
    expect(screen.getByRole('radio', { name: 'Bulto madre × 48' })).toBeTruthy()
    await userEvent.type(costo(), '1000')
    expect(screen.getByText(/Subtotal \$ 48\.000,00/)).toBeTruthy()
    await userEvent.press(confirmar())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ unidad: 'Bulto', cantidad: 4, unidadesPorUnidad: 12, costoUnitario: 1000 }))
  })

  it('no se compra una fracción de bulto', async () => {
    abrir({ precioCompraBase: 1000 })
    await userEvent.press(await screen.findByRole('radio', { name: 'Bulto × 12' }))
    await userEvent.type(costo(), '1000')
    await userEvent.clear(screen.getByLabelText('Bultos'))
    await userEvent.type(screen.getByLabelText('Bultos'), '2,5')
    expect(screen.getByText(/Se compran bultos enteros/)).toBeTruthy()
    expect(confirmar()).toBeDisabled()
  })

  it('avisa cuando el costo cambia más del 50 % respecto del último', async () => {
    abrir({ precioCompraBase: 1000 })
    await waitFor(() => expect(screen.getByText(/Último costo: \$ 1\.000,00/)).toBeTruthy())
    await userEvent.type(costo(), '1600')
    expect(screen.getByText(/Sube 60 % respecto del último costo/)).toBeTruthy()
    expect(screen.getByText(/Cambia más del 50 %/)).toBeTruthy()
    await userEvent.clear(costo())
    await userEvent.type(costo(), '400')
    expect(screen.getByText(/Baja 60 % respecto del último costo/)).toBeTruthy()
    await userEvent.clear(costo())
    await userEvent.type(costo(), '1100')
    expect(screen.getByText(/Sube 10 % respecto del último costo/)).toBeTruthy()
    expect(screen.queryByText(/Cambia más del 50 %/)).toBeNull()
  })

  it('sin costo la línea no se confirma y no se inventa uno; sin último costo (sin permiso) no hay aviso', async () => {
    abrir({ precioCompraBase: null })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Productos/pr1'))
    expect(costo().props.value).toBe('')
    expect(screen.getByText(/Falta el costo: el sistema nunca lo inventa/)).toBeTruthy()
    expect(confirmar()).toBeDisabled()
    await userEvent.type(costo(), '5000')
    expect(screen.queryByText(/respecto del último costo/)).toBeNull()
    expect(screen.queryByText(/Último costo/)).toBeNull()
  })

  it('abrir una línea y confirmarla sin tocar nada conserva la cantidad y el costo exactos', async () => {
    const onConfirm = abrir({ precioCompraBase: null }, { ...LINEA, cantidad: 2.345, costoUnitario: 12.345 })
    await userEvent.press(confirmar())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 2.345, costoUnitario: 12.345 }))
  })
})

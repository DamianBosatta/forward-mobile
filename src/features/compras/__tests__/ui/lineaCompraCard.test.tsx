import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LineaCompraCard } from '../../components/LineaCompraCard'
import type { LineaCompra } from '../../lib/lineaCompra'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))

const LINEA: LineaCompra = { productoId: 'pr1', nombre: 'Lavandina Ayudín 1 L', cantidad: 20, unidad: 'Bulto', unidadesPorUnidad: 12, costoUnitario: 742 }

function dibujar(linea: LineaCompra = LINEA, ficha: Record<string, unknown> = {}) {
  mockGet.mockResolvedValue({ id: 'pr1', bultoContenido: 12, bultoMadreContenido: 4, precioCompraBase: 710, ...ficha })
  const onCambiar = jest.fn()
  const onEditar = jest.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><LineaCompraCard linea={linea} onCambiar={onCambiar} onEditar={onEditar} /></QueryClientProvider>)
  return { onCambiar, onEditar }
}

describe('tarjeta de producto de la compra', () => {
  it('muestra el empaque, el subtotal sobre las unidades y el aviso de cambio de costo', async () => {
    dibujar()
    expect(screen.getByText('Bulto ×12 = 240 u')).toBeTruthy()
    expect(screen.getByText(/178\.080/)).toBeTruthy()
    expect(await screen.findByText(/Costo \+4,5 % sobre la última compra/)).toBeTruthy()
  })

  it('cambiar a bulto madre manda la línea con las unidades del empaque y el mismo costo por unidad', async () => {
    const { onCambiar } = dibujar({ ...LINEA, unidad: 'Unidad', unidadesPorUnidad: 1, cantidad: 3 })
    await userEvent.press(await screen.findByRole('radio', { name: 'Bulto madre' }))
    await waitFor(() => expect(onCambiar).toHaveBeenCalledWith(expect.objectContaining({ unidad: 'BultoMadre', cantidad: 3, unidadesPorUnidad: 48, costoUnitario: 742 })))
  })

  it('pasar a bulto con una cantidad con decimales la redondea a un bulto entero', async () => {
    const { onCambiar } = dibujar({ ...LINEA, unidad: 'Unidad', unidadesPorUnidad: 1, cantidad: 2.5 })
    await userEvent.press(await screen.findByRole('radio', { name: 'Bulto' }))
    await waitFor(() => expect(onCambiar).toHaveBeenCalledWith(expect.objectContaining({ unidad: 'Bulto', cantidad: 3, unidadesPorUnidad: 12 })))
  })

  it('sin costo la tarjeta dice "obligatorio" y "Sin costo"; con el costo tipeado manda la línea con costo', async () => {
    const { onCambiar } = dibujar({ ...LINEA, costoUnitario: null })
    expect(screen.getByText('obligatorio')).toBeTruthy()
    expect(screen.getByText('Sin costo')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Costo por unidad ($)'), '1.150,50')
    expect(onCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ costoUnitario: 1150.5 }))
  })

  it('un costo en cero no es un costo: la línea queda sin costo y se explica', async () => {
    const { onCambiar } = dibujar()
    const campo = screen.getByLabelText('Costo por unidad ($)')
    await userEvent.clear(campo)
    await userEvent.type(campo, '0')
    expect(onCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ costoUnitario: null }))
    expect(screen.getByText('Escribí un costo mayor a 0, por ejemplo 1.150,50.')).toBeTruthy()
  })

  it('una cantidad con decimales en bultos no se manda y avisa que son bultos enteros', async () => {
    const { onCambiar } = dibujar()
    onCambiar.mockClear()
    const campo = screen.getByLabelText('Bultos de Lavandina Ayudín 1 L')
    await userEvent.clear(campo)
    await userEvent.type(campo, '2,5')
    expect(onCambiar).not.toHaveBeenCalledWith(expect.objectContaining({ cantidad: 2.5 }))
    expect(screen.getByText('Se compran bultos enteros: escribí un número sin decimales.')).toBeTruthy()
  })

  it('tocar el nombre abre la hoja de la línea', async () => {
    const { onEditar } = dibujar()
    await userEvent.press(screen.getByRole('button', { name: 'Editar Lavandina Ayudín 1 L' }))
    expect(onEditar).toHaveBeenCalledWith(expect.objectContaining({ productoId: 'pr1' }))
  })
})

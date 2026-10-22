import React from 'react'
import { Alert } from 'react-native'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { BorradorVenta } from '@/libs/api-client/ventas'
import { ListaBorradores, textoDescartarBorrador } from '../../components/ListaBorradores'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a) }, API_URL: 'x' }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const b = (o: Partial<BorradorVenta> = {}) => ({
  id: 'b1', version: 1, clienteId: 'c', clienteNombre: 'Dietética Sol', clienteDireccion: 'Jara 1643', depositoId: 'd',
  fechaModificacion: new Date().toISOString(), cantidadLineas: 4, totalAmount: 23880, totalCurrency: 'ARS', tipoOperacion: 'Pedido', ...o,
}) as BorradorVenta

function pantalla(borradores: BorradorVenta[], onSeguir = jest.fn()) {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ListaBorradores borradores={borradores} cargando={false} error={false} onSeguir={onSeguir} /></QueryClientProvider>)
  return onSeguir
}

beforeEach(() => mockPost.mockReset().mockResolvedValue(true))

describe('R7 · borradores (ResBorradores): como la franja "En curso" de la web', () => {
  it('seguir retoma el borrador', async () => {
    const seguir = pantalla([b()])
    await userEvent.press(screen.getByRole('button', { name: 'Seguir' }))
    expect(seguir).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }))
  })

  it('descartar siempre pasa por la confirmación de la web y no descarta si se vuelve', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    pantalla([b()])
    await userEvent.press(screen.getByRole('button', { name: 'Descartar' }))
    expect(alerta).toHaveBeenCalledWith(
      '¿Descartar este borrador?',
      'Se va a descartar la venta en curso con Dietética Sol (4 líneas). No se puede deshacer.',
      expect.arrayContaining([expect.objectContaining({ text: 'Volver' }), expect.objectContaining({ text: 'Descartar', style: 'destructive' })]),
    )
    expect(mockPost).not.toHaveBeenCalled()
    alerta.mockRestore()
  })

  it('confirmar descarta en el servidor', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => botones?.find((x) => x.text === 'Descartar')?.onPress?.())
    pantalla([b()])
    await userEvent.press(screen.getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/b1/descartar-borrador'))
    alerta.mockRestore()
  })

  it('el texto de la confirmación cuenta una línea en singular', () => {
    expect(textoDescartarBorrador(b({ cantidadLineas: 1 }))).toBe('Se va a descartar la venta en curso con Dietética Sol (1 línea). No se puede deshacer.')
  })

  it('sin borradores lo dice', () => {
    pantalla([])
    expect(screen.getByText('No tenés borradores.')).toBeTruthy()
  })
})

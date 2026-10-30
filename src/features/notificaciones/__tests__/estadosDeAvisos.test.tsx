/**
 * Bloque 12, T13c (lienzo R16): la bandeja de avisos muestra "vacío" y "sin conexión" con el componente
 * de estados de pantalla. Las frases de hoy no cambian.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import { BandejaAvisos } from '../BandejaAvisos'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (url: string) => mockGet(url), post: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))

const SIN_RED = () => new TypeError('Network request failed')
const AVISO = {
  id: 'n1', tipo: 'VentaAutorizada', severidad: 'Info', presentacion: 'Toast', leida: false, fechaCreacion: '2026-10-16T12:05:00Z',
  titulo: 'Venta A00421 autorizada', mensaje: 'Ya podés prepararla.', accion: { destino: 'Venta', entidadId: 'v-9', etiqueta: 'Ver venta' },
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><BandejaAvisos /></QueryClientProvider>)
  return qc
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ items: [], noLeidas: 0, hayMas: false })
})

describe('Avisos: estados de la bandeja', () => {
  it('sin avisos: estado "vacío" con la frase de siempre', async () => {
    pintar()
    expect(await screen.findByRole('header', { name: 'No tenés avisos.' })).toBeTruthy()
  })

  it('sin avisos sin leer: la frase de "Sin leer"', async () => {
    pintar()
    await screen.findByRole('header', { name: 'No tenés avisos.' })
    await userEvent.press(screen.getByLabelText('Sin leer'))
    expect(await screen.findByRole('header', { name: 'No tenés avisos sin leer.' })).toBeTruthy()
  })

  it('sin conexión y sin nada guardado: estado "sin conexión" con Reintentar, que vuelve a pedir', async () => {
    mockGet.mockRejectedValueOnce(SIN_RED())
    pintar()

    expect(await screen.findByRole('header', { name: 'No pudimos cargar los avisos' })).toBeTruthy()
    expect(screen.getByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()

    mockGet.mockResolvedValue({ items: [AVISO], noLeidas: 1, hayMas: false })
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Venta A00421 autorizada')).toBeTruthy()
  })

  it('con lo guardado y sin conexión: los avisos siguen y un aviso dice a qué hora se guardó', async () => {
    mockGet.mockResolvedValue({ items: [AVISO], noLeidas: 1, hayMas: false })
    const qc = pintar()
    await screen.findByText('Venta A00421 autorizada')

    mockGet.mockRejectedValue(SIN_RED())
    await act(async () => { await qc.refetchQueries() })

    expect(await screen.findByText(/^Parece que no hay señal\. Mostramos lo último que guardó el teléfono a las \d\d:\d\d\.$/)).toBeTruthy()
    expect(screen.getByText('Venta A00421 autorizada')).toBeTruthy()
  })
})

import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FichaProducto } from '../components/FichaProducto'
import { BotonCatalogoPdf } from '../components/BotonCatalogoPdf'
import { novedadesDesde } from '../lib/presentacion'

jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: jest.fn(), post: jest.fn() } }))
const mockDownload = jest.fn()
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', downloadAsync: (...a: unknown[]) => mockDownload(...a), deleteAsync: jest.fn().mockResolvedValue(undefined) }))
const mockShare = jest.fn()
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => Promise.resolve(true), shareAsync: (...a: unknown[]) => mockShare(...a) }))
const mockSharePdf = jest.fn()
jest.mock('@/features/pedidos/lib/sharePdf', () => ({
  sharePdf: (...a: unknown[]) => mockSharePdf(...a),
  getSharing: () => jest.requireMock('expo-sharing'),
}))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }

function conCliente(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDownload.mockResolvedValue({ uri: 'file:///cache/foto-sap-aer-250.jpg', status: 200 })
  mockShare.mockResolvedValue(undefined)
  mockSharePdf.mockResolvedValue({ ok: true })
})

describe('Mandar foto', () => {
  const producto = { productoId: 'p1', nombre: 'Saphirus Aerosol', codigoPropio: 'SAP-AER-250', precioVenta: 100, esPadreDeVariantes: false, ventaMinimaUnidades: 1, disponible: true, disponibleVentaMinima: true, variantes: [], imageUrl: 'http://img.test/aer.jpg' }

  it('baja la foto y abre el panel para compartirla', async () => {
    api.get.mockImplementation((url: string) => (url.startsWith('/api/v1/catalogo/p1?') ? Promise.resolve(producto) : Promise.resolve([])))
    api.post.mockResolvedValue([])
    conCliente(<FichaProducto productoId="p1" />)
    await userEvent.setup().press(await screen.findByText('Mandar foto'))
    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1))
    expect(mockDownload.mock.calls[0][0]).toBe('http://img.test/aer.jpg')
    expect(mockShare.mock.calls[0][0]).toBe('file:///cache/foto-sap-aer-250.jpg')
    expect(mockShare.mock.calls[0][1]).toMatchObject({ mimeType: 'image/jpeg' })
  })

  it('sin foto no ofrece el botón', async () => {
    api.get.mockImplementation((url: string) => (url.startsWith('/api/v1/catalogo/p1?') ? Promise.resolve({ ...producto, imageUrl: null }) : Promise.resolve([])))
    api.post.mockResolvedValue([])
    conCliente(<FichaProducto productoId="p1" />)
    await screen.findByText('Saphirus Aerosol')
    expect(screen.queryByText('Mandar foto')).toBeNull()
  })
})

describe('Catálogo en PDF', () => {
  it('pide el PDF con la búsqueda, los filtros de la pantalla y, por defecto, en tarjetas con novedades de 30 días', async () => {
    const user = userEvent.setup()
    conCliente(<BotonCatalogoPdf busqueda=" sap " soloConStock conOferta />)
    await user.press(screen.getByText('Compartir catálogo en PDF'))
    await user.press(await screen.findByText('Generar PDF en tarjeta'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    const url = new URL(mockSharePdf.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/api/v1/catalogo/pdf')
    expect(url.searchParams.get('SearchTerm')).toBe('sap')
    expect(url.searchParams.get('SoloDisponibles')).toBe('true')
    expect(url.searchParams.get('ConOferta')).toBe('true')
    expect(url.searchParams.get('Formato')).toBe('Tarjeta')
    expect(url.searchParams.get('NovedadesDesde')).toBe(novedadesDesde(30))
    expect(mockSharePdf.mock.calls[0][1]).toMatch(/^catalogo-.*\.pdf$/)
  })

  it('en lista y con novedades de 7 días', async () => {
    const user = userEvent.setup()
    conCliente(<BotonCatalogoPdf busqueda="" soloConStock={false} />)
    await user.press(screen.getByText('Compartir catálogo en PDF'))
    await user.press(await screen.findByText('Lista'))
    await user.press(screen.getByText('7 días'))
    await user.press(screen.getByText('Generar PDF en lista'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    const url = new URL(mockSharePdf.mock.calls[0][0] as string)
    expect(url.searchParams.get('Formato')).toBe('Lista')
    expect(url.searchParams.get('NovedadesDesde')).toBe(novedadesDesde(7))
    expect(url.searchParams.get('SoloDisponibles')).toBeNull()
  })

  it('avisa si no se pudo generar', async () => {
    mockSharePdf.mockResolvedValue({ ok: false, reason: 'network', message: 'Error al descargar el archivo (500).' })
    const user = userEvent.setup()
    conCliente(<BotonCatalogoPdf busqueda="" soloConStock={false} />)
    await user.press(screen.getByText('Compartir catálogo en PDF'))
    await user.press(await screen.findByText('Generar PDF en tarjeta'))
    expect(await screen.findByText('Error al descargar el archivo (500).')).toBeTruthy()
  })
})

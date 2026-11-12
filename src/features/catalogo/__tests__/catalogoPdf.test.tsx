import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { BotonCatalogoPdf } from '../components/BotonCatalogoPdf'
import { novedadesDesde } from '../lib/presentacion'
import { useAuthStore } from '@/features/auth/store/auth.store'

// T11 (S6): el catálogo en PDF del teléfono tiene las mismas opciones que la web (catalogo-client.tsx + OpcionesPdf.tsx)
// y manda los mismos parámetros a GET /api/v1/catalogo/pdf; el archivo se comparte con el panel del sistema (WhatsApp).

jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: jest.fn(), post: jest.fn() } }))
const mockSharePdf = jest.fn()
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: (...a: unknown[]) => mockSharePdf(...a) }))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }

const LISTAS = [
  { id: 'l-may', nombre: 'Mayorista', markupPorcentaje: 10, activa: true },
  { id: 'l-vieja', nombre: 'Vieja', markupPorcentaje: 5, activa: false },
]

function conPermisos(modulos: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'u', roles: ['Vendedor'] as never, permissions: modulos.map((module) => ({ module, canRead: true })) as never },
  })
}

function renderBoton(props: Partial<React.ComponentProps<typeof BotonCatalogoPdf>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BotonCatalogoPdf busqueda="" soloConStock={false} puedeElegirLista={false} listaFija={null} {...props} />
    </QueryClientProvider>,
  )
}

const pedido = () => new URL(mockSharePdf.mock.calls[0][0] as string)
const params = (url: URL) => [...url.searchParams.entries()]

afterAll(() => onlineManager.setOnline(true))

beforeEach(() => {
  jest.clearAllMocks()
  onlineManager.setOnline(true)
  conPermisos(['MOD_CATALOGO'])
  mockSharePdf.mockResolvedValue({ ok: true })
  api.get.mockImplementation((url: string) => (url === '/api/v1/listas-precios' ? Promise.resolve(LISTAS) : Promise.reject(new Error(url))))
})

describe('Permiso', () => {
  it('con MOD_CATALOGO se ofrece exportar', () => {
    renderBoton()
    expect(screen.getByText('Exportar PDF')).toBeTruthy()
  })

  it('sin MOD_CATALOGO no aparece la acción', () => {
    conPermisos(['MOD_STOCK'])
    renderBoton()
    expect(screen.queryByText('Exportar PDF')).toBeNull()
  })
})

describe('Opciones como la web', () => {
  it('ofrece Lista, Tarjeta e Informativo, con Lista por defecto y sus opciones de precio', async () => {
    const user = userEvent.setup()
    renderBoton()
    await user.press(screen.getByText('Exportar PDF'))
    expect(await screen.findByText('Lista')).toBeTruthy()
    expect(screen.getByText('Tarjeta')).toBeTruthy()
    expect(screen.getByText('Informativo')).toBeTruthy()
    expect(screen.getByText('Lista de precios')).toBeTruthy()
    expect(screen.getByText('Descuentos a imprimir')).toBeTruthy()
    expect(screen.getByText('Novedades desde')).toBeTruthy()
  })

  it('el Informativo no muestra lista, descuentos ni novedades', async () => {
    const user = userEvent.setup()
    renderBoton()
    await user.press(screen.getByText('Exportar PDF'))
    await user.press(await screen.findByText('Informativo'))
    expect(screen.getByText('Catálogo informativo')).toBeTruthy()
    expect(screen.queryByText('Lista de precios')).toBeNull()
    expect(screen.queryByText('Descuentos a imprimir')).toBeNull()
    expect(screen.queryByText('Novedades desde')).toBeNull()
  })

  it('la Tarjeta no imprime escala de descuentos', async () => {
    const user = userEvent.setup()
    renderBoton()
    await user.press(screen.getByText('Exportar PDF'))
    await user.press(await screen.findByText('Tarjeta'))
    expect(screen.getByText('La tarjeta muestra solo el precio, sin escala de descuentos.')).toBeTruthy()
    expect(screen.queryByText('−20 %')).toBeNull()
  })

  it('quien tiene lista asignada la ve fija y no elige', async () => {
    const user = userEvent.setup()
    renderBoton({ listaFija: 'Minorista' })
    await user.press(screen.getByText('Exportar PDF'))
    expect(await screen.findByText('Minorista')).toBeTruthy()
    expect(screen.getByText('Es la lista que tenés asignada. El catálogo sale siempre con esta.')).toBeTruthy()
    expect(api.get).not.toHaveBeenCalled()
  })
})

describe('Generar', () => {
  it('Lista por defecto: los filtros de la pantalla, novedades de 30 días y sin descuentos de más (el servidor imprime 5, 10 y 15)', async () => {
    const user = userEvent.setup()
    renderBoton({ busqueda: ' sap ', soloConStock: true, conOferta: true, categoriaId: 'cat-1' })
    await user.press(screen.getByText('Exportar PDF'))
    await user.press(await screen.findByText('Generar catálogo'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    const url = pedido()
    expect(url.origin + url.pathname).toBe('http://api.test/api/v1/catalogo/pdf')
    expect(params(url)).toEqual([
      ['SearchTerm', 'sap'],
      ['SoloDisponibles', 'true'],
      ['ConOferta', 'true'],
      ['CategoriaId', 'cat-1'],
      ['Formato', 'Lista'],
      ['NovedadesDesde', novedadesDesde(30)],
    ])
    expect(mockSharePdf.mock.calls[0][1]).toMatch(/^catalogo-.*\.pdf$/)
  })

  it('Lista con descuentos elegidos y la lista de precios elegida', async () => {
    const user = userEvent.setup()
    renderBoton({ puedeElegirLista: true })
    await user.press(screen.getByText('Exportar PDF'))
    await user.press(await screen.findByText('Mayorista'))
    expect(screen.queryByText('Vieja')).toBeNull()
    await user.press(screen.getByText('−5 %'))
    await user.press(screen.getByText('−20 %'))
    await user.press(screen.getByText('Sin marcas'))
    await user.press(screen.getByText('Generar catálogo'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    expect(params(pedido())).toEqual([
      ['ListaPrecioId', 'l-may'],
      ['Formato', 'Lista'],
      ['Descuentos', '10'],
      ['Descuentos', '15'],
      ['Descuentos', '20'],
    ])
  })

  it('Lista sin ningún descuento manda SinDescuentos', async () => {
    const user = userEvent.setup()
    renderBoton()
    await user.press(screen.getByText('Exportar PDF'))
    for (const d of ['−5 %', '−10 %', '−15 %']) await user.press(await screen.findByText(d))
    expect(screen.getByText('Sin descuentos: sale solo el precio de lista.')).toBeTruthy()
    await user.press(screen.getByText('Generar catálogo'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    expect(pedido().searchParams.get('SinDescuentos')).toBe('true')
    expect(pedido().searchParams.getAll('Descuentos')).toEqual([])
  })

  it('Tarjeta: filtros y novedades, sin descuentos', async () => {
    const user = userEvent.setup()
    renderBoton({ soloConStock: true })
    await user.press(screen.getByText('Exportar PDF'))
    await user.press(await screen.findByText('Tarjeta'))
    await user.press(screen.getByText('7 días'))
    await user.press(screen.getByText('Generar catálogo'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    expect(params(pedido())).toEqual([
      ['SoloDisponibles', 'true'],
      ['Formato', 'Tarjeta'],
      ['NovedadesDesde', novedadesDesde(7)],
    ])
  })

  it('Informativo manda solo el formato, aunque haya filtros', async () => {
    const user = userEvent.setup()
    renderBoton({ busqueda: 'sap', soloConStock: true, conOferta: true, categoriaId: 'cat-1', puedeElegirLista: true })
    await user.press(screen.getByText('Exportar PDF'))
    await user.press(await screen.findByText('Informativo'))
    await user.press(screen.getByText('Generar catálogo'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    expect(params(pedido())).toEqual([['Formato', 'Informativo']])
  })

  it('si no se pudo generar, avisa y la hoja queda abierta', async () => {
    mockSharePdf.mockResolvedValue({ ok: false, reason: 'network', message: 'Error al descargar el archivo (500).' })
    const user = userEvent.setup()
    renderBoton()
    await user.press(screen.getByText('Exportar PDF'))
    await user.press(await screen.findByText('Generar catálogo'))
    expect(await screen.findByText('Error al descargar el archivo (500).')).toBeTruthy()
    expect(screen.getByText('Generar catálogo')).toBeTruthy()
  })

  it('sin conexión no se puede generar y dice por qué', async () => {
    onlineManager.setOnline(false)
    const user = userEvent.setup()
    renderBoton()
    await user.press(screen.getByText('Exportar PDF'))
    expect(await screen.findByText('Sin conexión: el catálogo se arma en el servidor. Probá cuando vuelva la señal.')).toBeTruthy()
    await user.press(screen.getByText('Generar catálogo'))
    expect(mockSharePdf).not.toHaveBeenCalled()
  })

  it('sin productos con estos filtros no genera, salvo el Informativo', async () => {
    const user = userEvent.setup()
    renderBoton({ totalCount: 0 })
    await user.press(screen.getByText('Exportar PDF'))
    expect(await screen.findByText('No hay productos para generar con estos filtros.')).toBeTruthy()
    await user.press(screen.getByText('Generar catálogo'))
    expect(mockSharePdf).not.toHaveBeenCalled()
    await user.press(screen.getByText('Informativo'))
    await user.press(screen.getByText('Generar catálogo'))
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
  })
})

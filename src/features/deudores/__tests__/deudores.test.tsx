import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import CuentasCorrientesScreen from '../../../../app/(tabs)/cuentas/index'
import { CuentaCorrienteCliente } from '@/features/cuentas/components/CuentaCorrienteCliente'
import { formatImporte as $ } from '@/core/ui/fw'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, paginaDeMovimientosSocio } from '@/features/cuentas/__testing__/servidor'

// T7 (S2): "poder ver tanto en telefono como web deudores , filtro por vendedores y que podamos exportar su cuenta
// corriente con lo que nos debe y nos pagos asi el cliente tiene conocimiento de lo que tenemos pdf y excel."

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: 'http://api.test' }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false }) }))
const mockSharePdf = jest.fn()
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: (...a: unknown[]) => mockSharePdf(...a) }))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock } }
const ESPERA = { timeout: 5000 }
jest.setTimeout(20_000)

const deudor = (extra: object = {}) => ({
  socioId: 'c1',
  razonSocial: 'Graciela Ruiz',
  cuit: '27243891563',
  saldoDeuda: 186420,
  saldoTst: 132020,
  saldoNormal: 54400,
  moneda: 'ARS',
  puedeVerCuentaCorriente: true,
  diasDeudaMasVieja: 40,
  vendedorId: 'v1',
  vendedorNombre: 'Lucía Ferreyra',
  ...extra,
})

const paginaDeDeudas = (items: object[], page = 1, totalPages = 1, deudaTotal = 186420) => ({
  pagina: { items, page, pageSize: 20, totalCount: items.length, totalPages, hasNextPage: page < totalPages },
  deudaTotal,
})

let deudas: (url: string) => unknown = () => paginaDeDeudas([deudor()])
const pedidosDeDeudas = () => api.get.mock.calls.map(([u]) => u as string).filter(u => u.startsWith('/api/v1/deudas/clientes'))
const ultimoPedido = () => new URL(`http://x${pedidosDeDeudas().at(-1)}`).searchParams

const TODOS = [
  { module: 'MOD_PAGOS', canRead: true },
  { module: 'MOD_CC', canRead: true },
  { module: 'MOD_CLIENTES', canRead: true },
  { module: 'MOD_VENTAS', canRead: true },
]

afterAll(() => onlineManager.setOnline(true))

beforeEach(() => {
  jest.clearAllMocks()
  onlineManager.setOnline(true)
  conPermisos(TODOS)
  mockSharePdf.mockResolvedValue({ ok: true })
  deudas = () => paginaDeDeudas([deudor()])
  api.get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/v1/deudas/clientes')) return deudas(url)
    if (url === '/api/v1/deudas/resumen') return { clientesConDeuda: 1, totalDeudaClientes: 186420, proveedoresConDeuda: 0, totalDeudaProveedores: 0 }
    if (url === '/api/v1/Ventas/vendedores') return [{ id: 'v1', nombre: 'Lucía Ferreyra' }, { id: 'v2', nombre: 'Tomás Gil' }]
    if (url.startsWith('/api/v1/socios-comerciales?')) return pagina([clienteDeLista()], 1)
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.includes('/movimientos')) return paginaDeMovimientosSocio([])
    return fichaConCuentas()
  })
})

async function abrirDeudores() {
  renderConQuery(<CuentasCorrientesScreen />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Deudores' }, ESPERA))
}

describe('Deudores en Cuentas', () => {
  it('lista los clientes que deben con su vendedor, desde GET /deudas/clientes', async () => {
    await abrirDeudores()

    expect(await screen.findByText('Graciela Ruiz', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText(/Lucía Ferreyra/)).toBeTruthy()
    expect(screen.getAllByText($(186420)).length).toBeGreaterThan(0)
    const p = ultimoPedido()
    expect(p.get('PageNumber')).toBe('1')
    expect(p.get('PageSize')).toBe('20')
    expect(p.get('VendedorId')).toBeNull()
    expect(p.get('SearchTerm')).toBeNull()
  })

  it('sin MOD_PAGOS:Read (el permiso de la pestaña Deudas de la web) no se ofrece la vista', async () => {
    conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_CLIENTES', canRead: true }])
    renderConQuery(<CuentasCorrientesScreen />)
    await screen.findByRole('radio', { name: /Me deben/ }, ESPERA)

    expect(screen.queryByRole('radio', { name: 'Deudores' })).toBeNull()
    expect(pedidosDeDeudas()).toHaveLength(0)
  })

  it('pide la página siguiente al llegar al final', async () => {
    deudas = (url) => (url.includes('PageNumber=2') ? paginaDeDeudas([deudor({ socioId: 'c2', razonSocial: 'Almacén Sur' })], 2, 2) : paginaDeDeudas([deudor()], 1, 2))
    await abrirDeudores()
    await screen.findByText('Graciela Ruiz', {}, ESPERA)

    fireEvent(screen.getByTestId('lista-deudores'), 'onEndReached')

    expect(await screen.findByText('Almacén Sur', {}, ESPERA)).toBeTruthy()
    expect(ultimoPedido().get('PageNumber')).toBe('2')
  })

  it('la búsqueda va al servidor como SearchTerm', async () => {
    await abrirDeudores()
    await screen.findByText('Graciela Ruiz', {}, ESPERA)

    await userEvent.type(screen.getByLabelText('Buscar deudor'), 'ruiz')

    await waitFor(() => expect(ultimoPedido().get('SearchTerm')).toBe('ruiz'), ESPERA)
  })

  it('filtra por vendedor con la lista de /ventas/vendedores (VendedorId)', async () => {
    await abrirDeudores()
    await screen.findByText('Graciela Ruiz', {}, ESPERA)

    await userEvent.press(screen.getByRole('button', { name: 'Vendedor: Todos' }))
    await userEvent.press(await screen.findByRole('radio', { name: 'Tomás Gil' }, ESPERA))

    await waitFor(() => expect(ultimoPedido().get('VendedorId')).toBe('v2'), ESPERA)
    expect(screen.getByRole('button', { name: 'Vendedor: Tomás Gil' })).toBeTruthy()
  })

  it('sin MOD_VENTAS:Read (lo pide /ventas/vendedores) no hay filtro por vendedor; el servidor ya acota la cartera', async () => {
    conPermisos(TODOS.filter(p => p.module !== 'MOD_VENTAS'))
    await abrirDeudores()
    await screen.findByText('Graciela Ruiz', {}, ESPERA)

    expect(screen.queryByRole('button', { name: /^Vendedor:/ })).toBeNull()
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/Ventas/vendedores')
  })

  it('sin deudores muestra el estado vacío, y con filtro dice que nada coincide', async () => {
    deudas = () => paginaDeDeudas([], 1, 1, 0)
    await abrirDeudores()

    expect(await screen.findByText('No hay clientes con saldo pendiente.', {}, ESPERA)).toBeTruthy()

    await userEvent.type(screen.getByLabelText('Buscar deudor'), 'zzz')
    expect(await screen.findByText('No encontramos clientes con saldo pendiente para ese filtro.', {}, ESPERA)).toBeTruthy()
  })

  it('sin conexión y sin nada guardado muestra "sin conexión", no la lista vacía', async () => {
    onlineManager.setOnline(false)
    await abrirDeudores()

    expect(await screen.findByText('No pudimos cargar los deudores', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText('No hay clientes con saldo pendiente.')).toBeNull()
  })

  it('tocar un deudor abre su cuenta corriente', async () => {
    await abrirDeudores()

    await userEvent.press(await screen.findByRole('button', { name: /^Graciela Ruiz, debe/ }, ESPERA))

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/cuentas/[id]', params: { id: 'c1' } })
  })
})

describe('Estado de cuenta en PDF o Excel', () => {
  it('PDF: arma la URL del export del socio y la comparte', async () => {
    await abrirDeudores()

    await userEvent.press(await screen.findByLabelText('Estado de cuenta de Graciela Ruiz', {}, ESPERA))
    await userEvent.press(await screen.findByRole('button', { name: 'Compartir' }, ESPERA))

    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    const [url, nombre] = mockSharePdf.mock.calls[0] as [string, string]
    expect(url).toBe('http://api.test/api/v1/cuentas-corrientes/socios/c1/estado-cuenta/export?formato=Pdf')
    expect(nombre).toMatch(/^estado-cuenta-graciela-ruiz-\d{4}-\d{2}-\d{2}\.pdf$/)
  })

  it('Excel con un período: formato=Excel, desde y hasta, y el archivo .xlsx', async () => {
    await abrirDeudores()

    await userEvent.press(await screen.findByLabelText('Estado de cuenta de Graciela Ruiz', {}, ESPERA))
    await userEvent.press(await screen.findByRole('radio', { name: 'Excel' }, ESPERA))
    await userEvent.press(screen.getByRole('radio', { name: 'Este mes' }))
    await userEvent.press(screen.getByRole('button', { name: 'Compartir' }))

    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    const [url, nombre] = mockSharePdf.mock.calls[0] as [string, string]
    const u = new URL(url)
    expect(u.pathname).toBe('/api/v1/cuentas-corrientes/socios/c1/estado-cuenta/export')
    expect(u.searchParams.get('formato')).toBe('Excel')
    expect(u.searchParams.get('desde')).toMatch(/^\d{4}-\d{2}-01$/)
    expect(u.searchParams.get('hasta')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(nombre).toMatch(/\.xlsx$/)
  })

  it('si no se pudo compartir, lo dice en la hoja', async () => {
    mockSharePdf.mockResolvedValue({ ok: false, reason: 'network', message: 'Error al descargar el archivo (500).' })
    await abrirDeudores()

    await userEvent.press(await screen.findByLabelText('Estado de cuenta de Graciela Ruiz', {}, ESPERA))
    await userEvent.press(await screen.findByRole('button', { name: 'Compartir' }, ESPERA))

    expect(await screen.findByText('Error al descargar el archivo (500).', {}, ESPERA)).toBeTruthy()
  })

  it('sin MOD_CC ni MOD_CLIENTES (los del export) no se ofrece la acción', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
    await abrirDeudores()
    await screen.findByText('Graciela Ruiz', {}, ESPERA)

    expect(screen.queryByLabelText('Estado de cuenta de Graciela Ruiz')).toBeNull()
  })

  it('un cliente cuya cuenta el servidor no deja ver no ofrece el archivo (daría 403)', async () => {
    deudas = () => paginaDeDeudas([deudor({ puedeVerCuentaCorriente: false })])
    await abrirDeudores()
    await screen.findByText('Graciela Ruiz', {}, ESPERA)

    expect(screen.queryByLabelText('Estado de cuenta de Graciela Ruiz')).toBeNull()
  })

  it('también desde la cuenta corriente del cliente', async () => {
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    await userEvent.press(await screen.findByRole('button', { name: 'Estado de cuenta' }, ESPERA))
    await userEvent.press(await screen.findByRole('button', { name: 'Compartir' }, ESPERA))

    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    expect(mockSharePdf.mock.calls[0][0]).toBe('http://api.test/api/v1/cuentas-corrientes/socios/c1/estado-cuenta/export?formato=Pdf')
  })

  it('en la cuenta corriente, sin MOD_CC ni MOD_CLIENTES no aparece', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
    await screen.findByText('Movimientos', {}, ESPERA)

    expect(screen.queryByRole('button', { name: 'Estado de cuenta' })).toBeNull()
  })
})

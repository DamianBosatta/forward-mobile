import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ElegirProveedor } from '../../components/ElegirProveedor'
import { formatImporte } from '@/core/ui/fw'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
let mockPuedeVerCompras = true
jest.mock('@/core/auth/RequirePermission', () => ({
  usePermissions: () => ({ canDo: (m: string, a: string) => mockPuedeVerCompras && m === 'MOD_COMPRAS' && a === 'read' }),
}))

const ESPERA = { timeout: 3000 }
const PROVEEDOR = { id: 'p1', razonSocial: 'Insumos del Sur SA', requiereCompletar: false }
const COMPRA = { id: 'c1', fecha: '2026-10-12T15:00:00Z', totalAmount: 125000, totalCurrency: 'ARS', estado: 'Recibido' }

let respuestaCompras: () => Promise<unknown>

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ElegirProveedor onElegir={jest.fn()} faltantes={null} error={null} /></QueryClientProvider>)
}
const comprasPedidas = () => mockGet.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/v1/Compras'))

beforeEach(() => {
  jest.clearAllMocks()
  mockPuedeVerCompras = true
  respuestaCompras = async () => ({ items: [COMPRA], totalCount: 9, page: 1, pageSize: 1 })
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return Promise.resolve({ items: [PROVEEDOR], totalCount: 1 })
    if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve({ id: 'p1', razonSocial: PROVEEDOR.razonSocial, condicionesDeCompraFaltantes: [] })
    if (url.startsWith('/api/v1/Compras')) return respuestaCompras()
    return Promise.reject(new Error(`GET inesperado ${url}`))
  })
})

describe('Elegir proveedor: Última compra', () => {
  it('al elegir un proveedor muestra la fecha y el total de su compra más reciente (pageSize=1)', async () => {
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: 'Insumos del Sur SA' }, ESPERA))

    expect(await screen.findByLabelText(`Última compra: 12/10/2026 · ${formatImporte(125000)}`, {}, ESPERA)).toBeTruthy()
    expect(comprasPedidas()).toEqual(['/api/v1/Compras?proveedorId=p1&pageNumber=1&pageSize=1'])
  })

  it('sin compras dice "Sin compras", no una fecha inventada', async () => {
    respuestaCompras = async () => ({ items: [], totalCount: 0, page: 1, pageSize: 1 })
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: 'Insumos del Sur SA' }, ESPERA))

    expect(await screen.findByLabelText('Última compra: Sin compras', {}, ESPERA)).toBeTruthy()
  })

  it('si el servidor falla lo dice', async () => {
    respuestaCompras = () => Promise.reject(new Error('boom'))
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: 'Insumos del Sur SA' }, ESPERA))

    expect(await screen.findByLabelText('Última compra: No se pudo cargar', {}, ESPERA)).toBeTruthy()
  })

  it('sin MOD_COMPRAS:Read no muestra la fila ni pide las compras', async () => {
    mockPuedeVerCompras = false
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: 'Insumos del Sur SA' }, ESPERA))

    expect(await screen.findByText('Condiciones del proveedor', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText('Última compra')).toBeNull()
    expect(comprasPedidas()).toEqual([])
  })
})

import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ElegirProveedor } from '../../components/ElegirProveedor'
import { PasosCompra } from '../../components/PasosCompra'
import { formatImporte } from '@/core/ui/fw'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
let mockPuedeVerCompras = true
jest.mock('@/core/auth/RequirePermission', () => ({
  usePermissions: () => ({ canDo: (m: string, a: string) => mockPuedeVerCompras && m === 'MOD_COMPRAS' && a === 'read' }),
}))

const ESPERA = { timeout: 3000 }
const PROVEEDOR = { id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: '30-12345678-9', requiereCompletar: false }
const INCOMPLETO = { id: 'p2', razonSocial: 'Lácteos Ficticios SRL', cuit: '30-11223344-5', requiereCompletar: true }
const COMPRA = { id: 'c1', fecha: '2026-10-12T15:00:00Z', totalAmount: 125000, totalCurrency: 'ARS', estado: 'Recibido' }

let respuestaCompras: () => Promise<unknown>
let respuestaRecientes: () => Promise<unknown>
let respuestaProveedores: () => Promise<unknown>

function pintar(onElegir = jest.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ElegirProveedor onElegir={onElegir} faltantes={null} error={null} /></QueryClientProvider>)
  return onElegir
}
const comprasDelProveedor = () => mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Compras?proveedorId'))
const recientesPedidos = () => mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Compras?Page'))

beforeEach(() => {
  jest.clearAllMocks()
  mockPuedeVerCompras = true
  respuestaCompras = async () => ({ items: [COMPRA], totalCount: 9, page: 1, pageSize: 1 })
  respuestaRecientes = async () => ({ items: [], totalCount: 0, page: 1, hasNextPage: false })
  respuestaProveedores = async () => ({ items: [PROVEEDOR, INCOMPLETO], totalCount: 2 })
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return respuestaProveedores()
    if (url === '/api/v1/socios-comerciales/p2') return Promise.resolve({ id: 'p2', razonSocial: INCOMPLETO.razonSocial, condicionesDeCompraFaltantes: ['el plazo de pago'] })
    if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve({ id: 'p1', razonSocial: PROVEEDOR.razonSocial, condicionesDeCompraFaltantes: [] })
    if (url.startsWith('/api/v1/Compras?proveedorId')) return respuestaCompras()
    if (url.startsWith('/api/v1/Compras?')) return respuestaRecientes()
    return Promise.reject(new Error(`GET inesperado ${url}`))
  })
})

describe('PasosCompra: Proveedor / Productos / Carrito / Recepción', () => {
  it.each([[1, 'Proveedor'], [2, 'Productos'], [3, 'Carrito'], [4, 'Recepción']] as const)('en el paso %i marca "%s"', (paso, nombre) => {
    render(<PasosCompra paso={paso} />)
    expect(screen.getByText(`Paso ${paso} de 4`)).toBeTruthy()
    for (const n of ['Proveedor', 'Productos', 'Carrito', 'Recepción']) expect(screen.getByText(n)).toBeTruthy()
    expect(screen.getByLabelText(`Paso ${paso} de 4: ${nombre}`)).toHaveProp('accessibilityState', { selected: true })
  })
})

describe('Elegir proveedor (paso 1)', () => {
  it('filas con radio: el botón sigue apagado hasta elegir uno, y elegir lo marca y lo habilita', async () => {
    const onElegir = pintar()
    const fila = await screen.findByRole('radio', { name: 'Insumos del Sur SA' }, ESPERA)
    expect(screen.getByRole('button', { name: 'Continuar a productos' })).toBeDisabled()
    await userEvent.press(fila)
    expect(screen.getByRole('radio', { name: 'Insumos del Sur SA' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: true }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar a productos' })).toBeEnabled(), ESPERA)
    await userEvent.press(screen.getByRole('button', { name: 'Continuar a productos' }))
    expect(onElegir).toHaveBeenCalledWith('p1')
  })

  it('Recientes: los proveedores de las últimas compras, sin repetir, con su última compra', async () => {
    respuestaRecientes = async () => ({
      items: [
        { id: 'a', numero: 229, proveedorId: 'p1', razonSocialProveedor: 'Insumos del Sur SA', fecha: '2026-11-01T10:00:00Z' },
        { id: 'b', numero: 228, proveedorId: 'p1', razonSocialProveedor: 'Insumos del Sur SA', fecha: '2026-10-30T10:00:00Z' },
        { id: 'c', numero: 227, proveedorId: 'p9', razonSocialProveedor: 'Almacén Mayorista Demo SA', fecha: '2026-10-29T10:00:00Z' },
      ],
      totalCount: 3, page: 1, hasNextPage: false,
    })
    pintar()
    expect(await screen.findByText('Recientes', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Última compra C-00229')).toBeTruthy()
    expect(screen.getByText('Última compra C-00227')).toBeTruthy()
    expect(screen.queryByText('Última compra C-00228')).toBeNull()
    expect(screen.getByRole('radio', { name: 'Almacén Mayorista Demo SA' })).toBeTruthy()
  })

  it('sin MOD_COMPRAS:Read no hay Recientes ni se piden compras', async () => {
    mockPuedeVerCompras = false
    pintar()
    await screen.findByRole('radio', { name: 'Insumos del Sur SA' }, ESPERA)
    expect(screen.queryByText('Recientes')).toBeNull()
    expect(recientesPedidos()).toEqual([])
  })

  it('elegido: las condiciones de solo lectura y la última compra (pageSize=1)', async () => {
    pintar()
    await userEvent.press(await screen.findByRole('radio', { name: 'Insumos del Sur SA' }, ESPERA))
    expect(await screen.findByText('Condiciones del proveedor', {}, ESPERA)).toBeTruthy()
    expect(await screen.findByLabelText(`Última compra: 12/10/2026 · ${formatImporte(125000)}`, {}, ESPERA)).toBeTruthy()
    expect(comprasDelProveedor()).toEqual(['/api/v1/Compras?proveedorId=p1&pageNumber=1&pageSize=1'])
  })

  it('sin compras dice "Sin compras", no una fecha inventada', async () => {
    respuestaCompras = async () => ({ items: [], totalCount: 0, page: 1, pageSize: 1 })
    pintar()
    await userEvent.press(await screen.findByRole('radio', { name: 'Insumos del Sur SA' }, ESPERA))
    expect(await screen.findByLabelText('Última compra: Sin compras', {}, ESPERA)).toBeTruthy()
  })

  it('si el servidor falla con la última compra lo dice', async () => {
    respuestaCompras = () => Promise.reject(new Error('boom'))
    pintar()
    await userEvent.press(await screen.findByRole('radio', { name: 'Insumos del Sur SA' }, ESPERA))
    expect(await screen.findByLabelText('Última compra: No se pudo cargar', {}, ESPERA)).toBeTruthy()
  })

  it('un proveedor sin datos de compra: lo dice en la fila, avisa qué falta y no deja seguir', async () => {
    const onElegir = pintar()
    await userEvent.press(await screen.findByRole('radio', { name: 'Lácteos Ficticios SRL, faltan datos de compra' }, ESPERA))
    expect(await screen.findByText('A Lácteos Ficticios SRL le falta el plazo de pago.', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText(/Completalo en la web para poder comprarle\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar a productos' })).toBeDisabled()
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('si no cargan los proveedores lo dice y "Reintentar" los vuelve a pedir', async () => {
    respuestaProveedores = () => Promise.reject(new Error('boom'))
    pintar()
    expect(await screen.findByText('No se pudieron cargar los proveedores.', {}, ESPERA)).toBeTruthy()
    respuestaProveedores = async () => ({ items: [PROVEEDOR], totalCount: 1 })
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('radio', { name: 'Insumos del Sur SA' }, ESPERA)).toBeTruthy()
  })

  it('una búsqueda sin resultados lo dice', async () => {
    respuestaProveedores = async () => ({ items: [], totalCount: 0 })
    pintar()
    expect(await screen.findByText('No hay proveedores con esa búsqueda.', {}, ESPERA)).toBeTruthy()
  })
})

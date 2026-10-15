import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { DetalleVentaNueva, diaDeEntrega } from '../components/DetalleVentaNueva'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'https://api',
  api: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}))
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: jest.fn() }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
jest.setTimeout(20000)

const cabecera = (o: Record<string, unknown> = {}) => ({
  id: 'v9', codigoPedido: 'A00417', clienteId: 'c7', clienteNombre: 'Carlos SRL', vendedorId: 'u1', vendedorNombre: 'Emanuel Parraquini',
  estado: 9, tipoOperacion: 2, version: 3, fecha: new Date().toISOString(), motivoPendienteAutorizacion: 4 | 32,
  fechaEntrega: '2026-10-08T00:00:00', metodoEntregaNombre: 'LogisticaPropia', metodoEntrega: 1, observaciones: 'Portón negro, antes de las 12',
  subtotalBrutoAmount: 503690.4, porcentajeDescuento: 0, montoDescuentoAmount: 0, cargoFleteAmount: 4287.15, totalAmount: 507977.55, ...o,
})
let mockVenta = { venta: cabecera(), detalles: [
  { id: 'i1', productoNombre: 'Detergente Magistral Limón 750 ml', cantidad: 36, precioUnitario: 2640, subtotal: 95040, porcentajeDescuentoItem: 14 },
  { id: 'i2', productoNombre: 'Trapo de piso gris Virulana', cantidad: 120, precioUnitario: 780, subtotal: 93600, porcentajeDescuentoItem: 0 },
], bultos: [] }
const socio = { id: 'c7', direccion: 'Juan B. Justo 6376', nombreFantasia: 'Autoservicio Carlos', nombreContacto: 'Carlos', condicionPago: { tipo: 'DiasDesdeEntrega', dias: 30 } }
const pagos = {
  ventaId: 'v9', total: 507977.55, montoPagado: 100000, saldoPendiente: 407977.55, estadoPago: 'Parcial',
  imputaciones: [{ pagoId: 'p1', numeroPago: 'Seña', medioPago: 'Transferencia', monto: 100000, fechaImputacion: new Date().toISOString(), origen: 'Pago' }],
}

function pantalla(onVolver?: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DetalleVentaNueva id="v9" onVolver={onVolver} /></QueryClientProvider>)
}

beforeEach(() => {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  useAuthStore.setState({ user: { id: 'u1', roles: ['Vendedor'], permissions: [{ module: 'MOD_VENTAS', canRead: true }] } as never })
  mockVenta = { ...mockVenta, venta: cabecera() }
  mockPush.mockReset()
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/api/v1/Ventas/v9') return Promise.resolve(mockVenta)
    if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
    if (url === '/api/v1/Ventas/v9/pagos') return Promise.resolve(pagos)
    if (url === '/api/v1/comisiones/simulacion/ventas/v9') return Promise.resolve({ comisionActiva: true, montoCobro: 507977.55, montoComision: 25184.52 })
    return Promise.resolve(undefined)
  })
})

describe('detalle de la venta nueva (PR 2.10)', () => {
  it('muestra número, cliente por dirección, estado, motivos del servidor, entrega, líneas, totales y cobros', async () => {
    pantalla()
    expect(await screen.findByText('Pedido A00417')).toBeTruthy()
    expect(await screen.findAllByText('Juan B. Justo 6376')).toHaveLength(2)
    expect(screen.getByText('Carlos · Autoservicio Carlos')).toBeTruthy()
    expect(screen.getByLabelText('Estado: Por autorizar')).toBeTruthy()
    expect(screen.getByText(/Hoy \d\d:\d\d · Emanuel Parraquini/)).toBeTruthy()
    expect(screen.getByText(/• Un descuento supera tu tope\. • Supera el tope de venta del cliente\. Te avisamos/)).toBeTruthy()
    expect(screen.getByText('Cuenta corriente, 30 días desde la entrega')).toBeTruthy()
    expect(screen.getByText('Jueves 8 de octubre')).toBeTruthy()
    expect(screen.getByText('Logística propia')).toBeTruthy()
    expect(screen.getByText('Portón negro, antes de las 12')).toBeTruthy()
    expect(screen.getByText('Líneas (2)')).toBeTruthy()
    expect(screen.getByText('Desc. 14 %')).toBeTruthy()
    expect(screen.getByText('Sin descuento')).toBeTruthy()
    expect(await screen.findByText('Transferencia · Seña')).toBeTruthy()
    expect(screen.getByText('Saldo del pedido')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Compartir PDF con el cliente' })).toBeTruthy()
  })

  it('la comisión estimada la da el servidor y solo en una venta propia', async () => {
    const r = pantalla()
    expect(await screen.findByText('Tu comisión estimada $ 25.184,52')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/comisiones/simulacion/ventas/v9')
    r.unmount()
    mockGet.mockClear()
    mockVenta = { ...mockVenta, venta: cabecera({ vendedorId: 'otro' }) }
    pantalla()
    await screen.findByText('Pedido A00417')
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Ventas/v9/pagos'))
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('simulacion'))).toBe(false)
    expect(screen.queryByText(/Tu comisión estimada/)).toBeNull()
  })

  it('con cobros parciales la comisión se simula sobre lo pendiente (el default del servidor) y se rotula así', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/v1/Ventas/v9') return Promise.resolve(mockVenta)
      if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
      if (url === '/api/v1/Ventas/v9/pagos') return Promise.resolve(pagos)
      // Igual que SimularComisionVentaQueryHandler: un monto mayor al saldo pendiente es 400.
      if (url.startsWith('/api/v1/comisiones/simulacion/ventas/v9?monto=')) return Promise.reject(new Error('El monto a cobrar supera el saldo pendiente de la venta.'))
      if (url === '/api/v1/comisiones/simulacion/ventas/v9') return Promise.resolve({ comisionActiva: true, montoCobro: 407977.55, montoComision: 20226.4 })
      return Promise.resolve(undefined)
    })
    pantalla()
    expect(await screen.findByText('Tu comisión estimada sobre lo pendiente de cobro $ 20.226,40')).toBeTruthy()
  })

  it('un retiro no muestra fecha y un presupuesto avisa que no reserva stock', async () => {
    mockVenta = { ...mockVenta, venta: cabecera({ tipoOperacion: 1, estado: 1, metodoEntregaNombre: 'RetiroEnLocal', codigoPedido: 'A00421' }) }
    pantalla()
    expect(await screen.findByText('Presupuesto A00421')).toBeTruthy()
    expect(screen.getByText('Retiro en el local')).toBeTruthy()
    expect(screen.queryByText('Jueves 8 de octubre')).toBeNull()
    expect(screen.getByText('No reserva stock.')).toBeTruthy()
  })

  it('"Ver ficha" abre el cliente; embebido en tablet, volver cierra el panel', async () => {
    const onVolver = jest.fn()
    pantalla(onVolver)
    await userEvent.press(await screen.findByRole('link', { name: 'Ver ficha' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/socios/c7')
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(onVolver).toHaveBeenCalled()
  })

  it('el día de entrega se lee tal cual se guardó, sin correrse por el huso', () => {
    // Medianoche argentina (03:00Z), como la guarda el servidor; 01:00Z todavía es el día anterior en Argentina.
    expect(diaDeEntrega('2026-10-08T03:00:00Z')).toBe('Jueves 8 de octubre')
    expect(diaDeEntrega('2026-10-08T01:00:00Z')).toBe('Miércoles 7 de octubre')
    expect(diaDeEntrega(null)).toBeNull()
  })
})

describe('detalle de la venta: motivo de anulación y fragancias (forward-system #884)', () => {
  const saphirus = (id: string, fragancia: string, cantidad: number, o: Record<string, unknown> = {}) => ({
    id, productoNombre: `Saphirus Aerosol 250 ml - ${fragancia}`, cantidad, precioUnitario: 3077.85, subtotal: cantidad * 3077.85, porcentajeDescuentoItem: 0,
    productoPadreId: 'p-saphirus', productoPadreNombre: 'Saphirus Aerosol 250 ml', ...o,
  })
  const lavandina = { id: 'i3', productoNombre: 'Lavandina Ayudín Clásica 2 L', cantidad: 60, precioUnitario: 1890, subtotal: 113400, porcentajeDescuentoItem: 5 }

  it('una venta anulada muestra el motivo con que se anuló', async () => {
    mockVenta = { ...mockVenta, venta: cabecera({ estado: 8, motivoAnulacion: 'Anulado por el cliente' }) }
    pantalla()
    expect(await screen.findByText('Se anuló Anulado por el cliente')).toBeTruthy()
    expect(screen.getByLabelText('Estado: Anulado')).toBeTruthy()
  })

  it('con un servidor anterior (sin motivo) la anulada se ve como antes: solo el chip', async () => {
    mockVenta = { ...mockVenta, venta: cabecera({ estado: 8 }) }
    pantalla()
    expect(await screen.findByLabelText('Estado: Anulado')).toBeTruthy()
    expect(screen.queryByText(/Se anuló/)).toBeNull()
  })

  it('las fragancias de una línea se agrupan bajo su nombre, con el reparto', async () => {
    mockVenta = { venta: cabecera(), detalles: [saphirus('f1', 'Coco Vainilla', 12), lavandina, saphirus('f2', 'Bamboo', 12)], bultos: [] }
    pantalla()
    expect(await screen.findByText('Saphirus Aerosol 250 ml · fragancias')).toBeTruthy()
    expect(screen.getByText('Coco Vainilla 12 · Bamboo 12')).toBeTruthy()
    expect(screen.getByText('24 × $ 3.077,85')).toBeTruthy()
    expect(screen.getByText('$ 73.868,40')).toBeTruthy()
    expect(screen.getByText('Lavandina Ayudín Clásica 2 L')).toBeTruthy()
    expect(screen.queryByText('Saphirus Aerosol 250 ml - Bamboo')).toBeNull()
  })

  it('con un servidor anterior (sin la línea) cada fragancia es una línea propia', async () => {
    const sinPadre = { productoPadreId: undefined, productoPadreNombre: undefined }
    mockVenta = { venta: cabecera(), detalles: [saphirus('f1', 'Coco Vainilla', 12, sinPadre), saphirus('f2', 'Bamboo', 12, sinPadre)], bultos: [] }
    pantalla()
    expect(await screen.findByText('Saphirus Aerosol 250 ml - Coco Vainilla')).toBeTruthy()
    expect(screen.getByText('Saphirus Aerosol 250 ml - Bamboo')).toBeTruthy()
    expect(screen.queryByText(/· fragancias/)).toBeNull()
  })
})

describe('detalle de la venta: vencimiento del saldo (forward-system, 9B prioridad 3)', () => {
  function conPagos(extra: object) {
    const base = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => (url === '/api/v1/Ventas/v9/pagos' ? Promise.resolve({ ...pagos, ...extra }) : base(url)))
  }

  it('bajo el saldo dice cuándo vence y el plazo, los dos del servidor', async () => {
    conPagos({ vencimientoSaldo: '2026-11-07', plazoVencimientoDias: 30 })
    pantalla()
    expect(await screen.findByText('Vence el 7 de noviembre (30 días)')).toBeTruthy()
  })

  it('sin vencimiento (servidor anterior o venta sin deuda) no dice nada nuevo', async () => {
    conPagos({ vencimientoSaldo: null })
    pantalla()
    expect(await screen.findByText('Saldo del pedido')).toBeTruthy()
    expect(screen.queryByText(/Vence/)).toBeNull()
  })
})

import React from 'react'
import { Alert, Linking } from 'react-native'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { formatImporte } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { DetalleVenta } from '../../components/DetalleVenta'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'https://api',
  api: {
    get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a), delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
const mockShare = jest.fn()
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: (...a: unknown[]) => mockShare(...a) }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
jest.setTimeout(20000)

const cabecera = (o: Record<string, unknown> = {}) => ({
  id: 'v9', codigoPedido: 'A00419', clienteId: 'c7', clienteNombre: 'Abel SRL', clienteTelefono: '011 4321-5678', vendedorId: 'u1',
  vendedorNombre: 'Emanuel Parraquini', estado: 3, tipoOperacion: 2, version: 3, fecha: new Date().toISOString(),
  fechaEntrega: '2026-10-22T00:00:00', conFactura: true, metodoEntregaNombre: 'LogisticaPropia',
  subtotalBrutoAmount: 85438.26, porcentajeDescuento: 0, montoDescuentoAmount: 0, cargoFleteAmount: 3300.63, totalAmount: 88738.89, ...o,
})
const detalles = [
  { id: 'i1', productoNombre: 'Pala c/Cabo Fija LP', cantidad: 12, precioUnitario: 2496, subtotal: 29952, porcentajeDescuentoItem: 0 },
  { id: 'i2', productoNombre: 'Make Lavajean', cantidad: 6, precioUnitario: 2271.25, subtotal: 13627.5, porcentajeDescuentoItem: 0 },
]
let mockVenta: { venta: ReturnType<typeof cabecera>; detalles: typeof detalles; bultos: never[] }
const socio = { id: 'c7', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel', telefono: '221 555-0182', deudaVencidaAmount: 84300 }
type Permisos = Record<string, Record<string, boolean>>
const TODOS: Permisos = { MOD_VENTAS: { canRead: true, canCreate: true, canUpdate: true, canDelete: true }, MOD_PAGOS: { canRead: true, canCreate: true } }
const permisos = (p: Permisos = TODOS) =>
  useAuthStore.setState({ user: { id: 'u1', roles: ['Vendedor'], permissions: Object.entries(p).map(([module, v]) => ({ module, ...v })) } as never })
const venta = (o: Record<string, unknown> = {}) => { mockVenta = { venta: cabecera(o), detalles, bultos: [] } }

function pantalla(onVolver?: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DetalleVenta id="v9" onVolver={onVolver} /></QueryClientProvider>)
}

beforeEach(() => {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  permisos()
  venta()
  for (const m of [mockPush, mockPost, mockPut, mockDelete, mockShare]) m.mockReset()
  mockPost.mockResolvedValue(true)
  mockPut.mockResolvedValue(undefined)
  mockDelete.mockResolvedValue(undefined)
  mockShare.mockResolvedValue({ ok: true })
  mockGet.mockReset().mockImplementation((url: string) => {
    if (url === '/api/v1/Ventas/v9') return Promise.resolve(mockVenta)
    if (url === '/api/v1/socios-comerciales/c7') return Promise.resolve(socio)
    if (url === '/api/v1/Ventas/v9/pagos') return Promise.resolve({ ventaId: 'v9', total: 88738.89, montoPagado: 0, saldoPendiente: 88738.89, estadoPago: 'Pendiente', imputaciones: [] })
    return Promise.resolve(undefined)
  })
})

describe('R1 · detalle del pedido (ResVentaDetalle, TV7)', () => {
  it('muestra número, cliente, línea de tiempo, entrega, factura, líneas, flete y total', async () => {
    pantalla()
    expect(await screen.findByText('Pedido A00419')).toBeTruthy()
    expect(await screen.findByText('Tarantino 1898 · Autoservicio Abel')).toBeTruthy()
    expect(screen.getByLabelText('Estado del pedido')).toBeTruthy()
    expect(screen.getByText('Preparando')).toBeTruthy()
    expect(screen.getByText('Entrega')).toBeTruthy()
    expect(screen.getByText('Con factura')).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Productos' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Entrega y factura' })).toBeTruthy()
    expect(screen.getByText('Pala c/Cabo Fija LP')).toBeTruthy()
    expect(screen.getByText('12 × $ 2.496,00')).toBeTruthy()
    expect(screen.getByText('$ 29.952,00')).toBeTruthy()
    expect(screen.getByText('Flete')).toBeTruthy()
    expect(screen.getByLabelText(/^Total: /)).toBeTruthy()
  })

  it('sin cobros no hay tarjeta "Cobro"', async () => {
    pantalla()
    await screen.findByText('Pedido A00419')
    expect(screen.queryByRole('header', { name: 'Cobro' })).toBeNull()
  })

  it('con cobros muestra la tarjeta "Cobro": fecha y medio, importe y saldo; las notas de crédito no son cobros', async () => {
    const pagos = {
      ventaId: 'v9', total: 88738.89, montoPagado: 40000, saldoPendiente: 48738.89, estadoPago: 'Parcial',
      imputaciones: [
        { numeroPago: 'P-1', medioPago: 'Transferencia', cuentaNombre: 'Banco Galicia', monto: 40000, fechaImputacion: '2026-10-30T15:00:00Z', origen: 'AutomaticaFifo' },
        { numeroPago: 'P-2', medioPago: 'Efectivo', cuentaNombre: null, monto: 1000, fechaImputacion: '2026-10-30T15:00:00Z', origen: 'AutomaticaFifo' },
        { numeroPago: 'NC-1', medioPago: 'NotaCredito', monto: 500, fechaImputacion: '2026-10-30T15:00:00Z', origen: 'NotaCredito' },
      ],
    }
    mockGet.mockImplementation((url: string) => Promise.resolve(
      url === '/api/v1/Ventas/v9' ? mockVenta : url === '/api/v1/socios-comerciales/c7' ? socio : url === '/api/v1/Ventas/v9/pagos' ? pagos : undefined))
    pantalla()
    expect(await screen.findByRole('header', { name: 'Cobro' })).toBeTruthy()
    expect(screen.getByText('Cobrado 30/10 · Transferencia · Banco Galicia')).toBeTruthy()
    expect(screen.getByText('Cobrado 30/10 · Efectivo')).toBeTruthy()
    expect(screen.getByText(formatImporte(40000))).toBeTruthy()
    expect(screen.queryByText(/NotaCredito/)).toBeNull()
    expect(screen.getByText('Saldo')).toBeTruthy()
    expect(screen.getByText(formatImporte(48738.89))).toBeTruthy()
  })

  it('un pedido que ya se prepara no se edita y dice por qué; anular sigue disponible', async () => {
    pantalla()
    await screen.findByText('Pedido A00419')
    expect(screen.getByText('Ya lo están preparando: no se puede editar. Para cambiarlo, hablá con el depósito.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeEnabled()
  })

  it('confirmado con MOD_VENTAS modificar: se edita (venta nueva en modo editar)', async () => {
    venta({ estado: 2 })
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Editar' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva?editar=v9')
  })

  it('En ruta: Anular queda deshabilitado con el motivo a la vista', async () => {
    venta({ estado: 5 })
    pantalla()
    await screen.findByText('Pedido A00419')
    expect(screen.getByRole('button', { name: 'Anular' })).toBeDisabled()
    expect(screen.getByText('No se puede anular: el pedido está en ruta.')).toBeTruthy()
  })

  it('sin MOD_VENTAS borrar no hay Anular ni motivo', async () => {
    permisos({ ...TODOS, MOD_VENTAS: { canRead: true, canUpdate: true } })
    venta({ estado: 5 })
    pantalla()
    await screen.findByText('Pedido A00419')
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull()
    expect(screen.queryByText('No se puede anular: el pedido está en ruta.')).toBeNull()
  })

  it('Cobrar lleva al cobro del cliente (flujo de cuentas) y pide MOD_PAGOS leer y crear', async () => {
    const r = pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Cobrar' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: 'c7' } })
    r.unmount()
    permisos({ MOD_VENTAS: TODOS.MOD_VENTAS!, MOD_PAGOS: { canRead: true } })
    pantalla()
    await screen.findByText('Pedido A00419')
    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull()
  })

  it('PDF comparte el de la venta; WhatsApp abre el chat con el texto de la web', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'PDF' }))
    await waitFor(() => expect(mockShare).toHaveBeenCalled())
    await userEvent.press(screen.getByRole('button', { name: 'WhatsApp' }))
    expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/5491143215678\?text=Hola!/))
    expect(decodeURIComponent(String(abrir.mock.calls[0]![0])).replace(/\u00a0/g, ' ')).toContain('Total: $ 88.738,89.')
    abrir.mockRestore()
  })

  it('embebido en la tablet, volver cierra el panel', async () => {
    const cerrar = jest.fn()
    pantalla(cerrar)
    await userEvent.press(await screen.findByLabelText('Volver'))
    expect(cerrar).toHaveBeenCalled()
  })
})

describe('R4 · anular igual que la web (sin motivo)', () => {
  it('muestra la confirmación de la web y no pide motivo', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Anular' }))
    expect(await screen.findByText('¿Deseas anular esta venta? Se liberará el stock reservado.')).toBeTruthy()
    expect(screen.queryByText('¿Por qué? (obligatorio)')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByRole('button', { name: 'Anular Venta' })).toBeEnabled()
  })

  it('al confirmar manda "Cancelación manual" y la versión', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Anular' }))
    await userEvent.press(await screen.findByRole('button', { name: 'Anular Venta' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/v1/Ventas/v9', { version: 3, motivoAnulacion: 'Cancelación manual' }))
  })

  it('"Cancelar" cierra sin anular', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Anular' }))
    await userEvent.press(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

describe('R2 · presupuesto (ResPresupuesto)', () => {
  beforeEach(() => venta({ estado: 1, tipoOperacion: 1, codigoPedido: null }))

  it('Pasar a pedido pide confirmación y convierte con la versión', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => { botones?.find((b) => b.text === 'Pasar a pedido')?.onPress?.() })
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Pasar a pedido' }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/v1/Ventas/v9/convertir-a-pedido', { version: 3, usuarioGeneradorId: 'u1' }))
    alerta.mockRestore()
  })

  it('avisa que no reserva stock, que vence a los 45 días y no ofrece cobrar', async () => {
    pantalla()
    expect(await screen.findByText(/Un presupuesto no reserva stock/)).toBeTruthy()
    expect(screen.getByText(/45 días/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
  })

  it('sin MOD_VENTAS modificar no hay Pasar a pedido ni Editar', async () => {
    permisos({ MOD_VENTAS: { canRead: true, canDelete: true } })
    pantalla()
    await screen.findByText(/Un presupuesto no reserva stock/)
    expect(screen.queryByRole('button', { name: 'Pasar a pedido' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  })

  it('vencido: el botón dice Reabrir y vuelve a correr los 45 días', async () => {
    venta({ estado: 10, tipoOperacion: 1, codigoPedido: null })
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Reabrir' }))
    expect(screen.queryByRole('button', { name: 'Pasar a pedido' })).toBeNull()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/v9/reabrir'))
  })
})

describe('R3 · rechazado (ResRechazada, TV8)', () => {
  beforeEach(() => venta({
    estado: 11, motivoRechazoAutorizacion: 'Cobrar lo vencido antes de entregar', autorizadoPor: 'Marta G.', motivoPendienteAutorizacion: 16 | 32,
    fechaModificacion: new Date().toISOString(),
  }))

  it('muestra el motivo del rechazo, quién lo decidió y por qué esperaba', async () => {
    pantalla()
    expect(await screen.findByText('Rechazado por gestión')).toBeTruthy()
    expect(screen.getByText('“Cobrar lo vencido antes de entregar”')).toBeTruthy()
    expect(screen.getByText(/Marta G\./)).toBeTruthy()
    expect(screen.getByText(/Deuda vencida/)).toBeTruthy()
    expect(screen.getByText('Un pedido rechazado ya no se puede editar: queda como registro para vos y para gestión.')).toBeTruthy()
  })

  it('no se edita ni se anula, ni deshabilitado', async () => {
    pantalla()
    await screen.findByText('Rechazado por gestión')
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull()
  })

  it('¿Qué hacés ahora?: cobrar lo vencido, armar uno nuevo igual y llamar al cliente', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: /Cobrar lo vencido/ }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: 'c7' } })
    await userEvent.press(screen.getByRole('button', { name: /Armar uno nuevo igual/ }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva?duplicar=v9')
    await userEvent.press(screen.getByRole('button', { name: /Llamar al cliente/ }))
    expect(abrir).toHaveBeenCalledWith('tel:2215550182')
    abrir.mockRestore()
  })

  it('sin MOD_VENTAS crear no ofrece armar uno nuevo; sin MOD_PAGOS no ofrece cobrar', async () => {
    permisos({ MOD_VENTAS: { canRead: true }, MOD_PAGOS: { canRead: true } })
    pantalla()
    await screen.findByText('Rechazado por gestión')
    expect(screen.queryByRole('button', { name: /Armar uno nuevo igual/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cobrar lo vencido/ })).toBeNull()
  })
})

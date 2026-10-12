import React from 'react'
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraNueva } from '../../components/CompraNueva'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { tomarAviso } from '../../lib/confirmar-y-recibir'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
const mockPostConSobre = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
    postConSobre: (...a: unknown[]) => mockPostConSobre(...a),
  },
  API_URL: 'x',
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }) }))
let mockPuedeModificar = true
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (m: string, a: string) => mockPuedeModificar && m === 'MOD_COMPRAS' && a === 'update' }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const ESPERA = { timeout: 3000 }
const COMPLETO = { id: 'p1', razonSocial: 'Insumos del Sur SA', requiereCompletar: false }
const INCOMPLETO = { id: 'p2', razonSocial: 'Gorrión Mayorista', requiereCompletar: true }

let mockCondicion: { tipo: string; dias: number; descripcion: string } | undefined
function socio(id: string) {
  return id === 'p2'
    ? { id, razonSocial: 'Gorrión Mayorista', condicionesDeCompraFaltantes: ['condición de pago', 'franja de entrega'] }
    : { id, razonSocial: 'Insumos del Sur SA', condicionPago: mockCondicion, condicionesDeCompraFaltantes: [] }
}

function pantalla(props: { borradorId?: string } = {}) {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><CompraNueva {...props} /></QueryClientProvider>)
}

const puts = () => mockPut.mock.calls.map(([, body]) => body as { detalles: { costoUnitario: number; cantidad: number; unidadCompra: string }[] })

beforeEach(() => {
  jest.clearAllMocks()
  mockPuedeModificar = true
  mockCondicion = { tipo: 'DiasDesdeEntrega', dias: 30, descripcion: '30 días' }
  mockPostConSobre.mockResolvedValue({ data: 'c1', sobre: { succeeded: true, message: 'Compra confirmada. Compra recibida.' } })
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return Promise.resolve({ items: [COMPLETO, INCOMPLETO], totalCount: 2 })
    if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve(socio(url.split('/').pop()!))
    if (url.startsWith('/api/v1/Productos?')) return Promise.resolve({ items: [{ id: 'pr1', nombre: 'Balde Nuvia 10L' }], page: 1, totalCount: 1, hasNextPage: false })
    if (url === '/api/v1/Productos/pr1') return Promise.resolve({ id: 'pr1', precioCompraBase: 1020 })
    if (url === '/api/v1/Depositos') return Promise.resolve([{ id: DEPOSITO_CENTRAL_ID, nombre: 'Depósito Central' }])
    if (url === '/api/v1/Compras/b9') {
      return Promise.resolve({
        id: 'b9', version: 40, proveedorId: 'p1', depositoId: DEPOSITO_CENTRAL_ID, gastosOperativos: 0, subtotalBrutoAmount: 0, descuentoTotalAmount: 0,
        detalles: [{ productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 0 }],
      })
    }
    return Promise.reject(new Error(`GET inesperado ${url}`))
  })
  mockPost.mockImplementation((url: string) => {
    if (url === '/api/v1/Compras/borradores') return Promise.resolve({ compraId: 'c1', version: 10, message: 'ok' })
    return Promise.resolve(undefined)
  })
  let v = 10
  mockPut.mockImplementation(() => Promise.resolve({ compraId: 'c1', version: ++v, message: 'ok' }))
})

async function agregarBalde(cantidad: string) {
  await userEvent.press(screen.getByRole('button', { name: '+ Agregar productos' }))
  await userEvent.type(await screen.findByPlaceholderText('0'), cantidad)
}

describe('pantalla de compra nueva', () => {
  it('a un proveedor sin condición de pago o franja no se le compra: aviso y no se crea el borrador', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: /Gorrión Mayorista/ }))
    expect(await screen.findByText(/le falta condición de pago y franja de entrega/)).toBeTruthy()
    expect(screen.getByText(/Completalo en la web para poder comprarle/)).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('una línea sin costo queda marcada y no se puede confirmar hasta cargarle el costo', async () => {
    mockGet.mockImplementation((url: string) =>
      url === '/api/v1/Compras/b9'
        ? Promise.resolve({ id: 'b9', version: 40, proveedorId: 'p1', depositoId: 'd', gastosOperativos: 0, subtotalBrutoAmount: 0, descuentoTotalAmount: 0,
            detalles: [{ productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 0 }] })
        : url.startsWith('/api/v1/socios-comerciales/') ? Promise.resolve(socio('p1')) : Promise.resolve([]))
    pantalla({ borradorId: 'b9' })
    expect(await screen.findByText('48 × — · Falta el costo')).toBeTruthy()
    expect(screen.getByText(/Una línea no tiene costo/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    // Tocar la línea abre la edición: con el costo cargado deja de estar marcada y se puede confirmar.
    await userEvent.press(screen.getByRole('button', { name: /Balde Nuvia 10L, 48 × —/ }))
    await userEvent.type(screen.getByLabelText('Costo por unidad ($)'), '1.150,50')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('48 × 1150,5 · 4 bultos de 12')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await waitFor(() => expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 4, costoUnitario: 1150.5, unidadCompra: 'Bulto' }), ESPERA)
  })

  it('confirmar guarda lo pendiente y después confirma; abre la compra', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('button', { name: 'Insumos del Sur SA' }))
    await screen.findByText('Insumos del Sur SA · 30 días')
    await agregarBalde('3')
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled())
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar compra' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/c1/confirmar', { compraId: 'c1' }), ESPERA)
    expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 3, costoUnitario: 1020 })
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/c1')
  })

  describe('confirmar y recibir', () => {
    const URL_CYR = '/api/v1/Compras/c1/confirmar-y-recibir'
    async function abrirHoja(proveedor = 'Insumos del Sur SA') {
      pantalla()
      await userEvent.press(await screen.findByRole('button', { name: proveedor }))
      await agregarBalde('3')
      await userEvent.press(screen.getByRole('button', { name: 'Cerrar' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar y recibir' })).toBeEnabled())
      await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
    }
    const enviar = () => userEvent.press(screen.getAllByRole('button', { name: 'Confirmar y recibir' }).at(-1)!)

    it('guarda lo pendiente y hace UNA llamada con la versión de ese guardado y la fecha de factura; abre la compra con el mensaje del servidor', async () => {
      mockCondicion = { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' }
      await abrirHoja()
      fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
      await enviar()
      await waitFor(() => expect(mockReplace).toHaveBeenCalled(), ESPERA)
      expect(mockPostConSobre).toHaveBeenCalledTimes(1)
      expect(mockPostConSobre).toHaveBeenCalledWith(URL_CYR, { version: 10 + mockPut.mock.calls.length, fechaFacturaProveedor: '2026-10-05' })
      expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 3, costoUnitario: 1020 })
      expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Compras/c1/confirmar', expect.anything())
      // En la URL solo la clave; el mensaje del servidor queda en memoria para el detalle.
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/c1?aviso=recibida')
      expect(tomarAviso('c1', 'recibida')).toMatchObject({ texto: 'Compra confirmada. Compra recibida.', tono: 'exito' })
    })

    it('409 CompraYaRecibida no es un error: abre la compra avisando que ya quedó recibida', async () => {
      mockPostConSobre.mockRejectedValue(Object.assign(new Error('La compra ya fue recibida.'), { status: 409, codigo: 'CompraYaRecibida', data: 'c1' }))
      await abrirHoja()
      await enviar()
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/c1?aviso=ya-recibida'), ESPERA)
      expect(tomarAviso('c1', 'ya-recibida')).toMatchObject({ texto: 'La compra ya quedó recibida.', tono: 'exito' })
      expect(screen.queryByText('La compra ya fue recibida.')).toBeNull()
    })

    it('sin condición conocida manda sin fecha; el 400 del servidor queda a la vista y no sale de la pantalla', async () => {
      mockCondicion = undefined
      mockPostConSobre.mockRejectedValue(Object.assign(new Error('Falta la fecha de la factura del proveedor.'), { status: 400 }))
      await abrirHoja()
      expect(screen.queryByLabelText('Fecha de la factura')).toBeNull()
      await enviar()
      expect(await screen.findByText('Falta la fecha de la factura del proveedor.', {}, ESPERA)).toBeTruthy()
      expect(mockPostConSobre).toHaveBeenCalledWith(URL_CYR, expect.objectContaining({ fechaFacturaProveedor: null }))
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('otro 409: muestra el motivo y recarga la compra', async () => {
      mockPostConSobre.mockRejectedValue(Object.assign(new Error('Otro usuario modificó la compra.'), { status: 409 }))
      await abrirHoja()
      const base = mockGet.getMockImplementation()!
      mockGet.mockImplementation((url: string) => base(url === '/api/v1/Compras/c1' ? '/api/v1/Compras/b9' : url))
      mockGet.mockClear()
      await enviar()
      await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Compras/c1'), ESPERA)
      expect(await screen.findByText('Otro usuario modificó la compra.', {}, ESPERA)).toBeTruthy()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('tras un 409 y la recarga, la fecha de factura escrita sigue ahí y el reintento la manda', async () => {
      mockCondicion = { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' }
      mockPostConSobre.mockRejectedValueOnce(Object.assign(new Error('Otro usuario modificó la compra.'), { status: 409 }))
      await abrirHoja()
      const base = mockGet.getMockImplementation()!
      mockGet.mockImplementation((url: string) => base(url === '/api/v1/Compras/c1' ? '/api/v1/Compras/b9' : url))
      fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
      await enviar()
      await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Compras/c1'), ESPERA)
      expect(await screen.findByText('Otro usuario modificó la compra.', {}, ESPERA)).toBeTruthy()
      expect((await screen.findByLabelText('Fecha de la factura', {}, ESPERA)).props.value).toBe('05/10/2026')
      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Confirmar y recibir' }).at(-1)).toBeEnabled(), ESPERA)
      await enviar()
      await waitFor(() => expect(mockPostConSobre).toHaveBeenCalledTimes(2), ESPERA)
      expect(mockPostConSobre).toHaveBeenLastCalledWith(URL_CYR, expect.objectContaining({ fechaFacturaProveedor: '2026-10-05' }))
    })

    it('sin respuesta (red o timeout) no dice que no se hizo: abre la compra para revisarla', async () => {
      mockPostConSobre.mockRejectedValue(new TypeError('Network request failed'))
      await abrirHoja()
      await enviar()
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/c1?aviso=incierto'), ESPERA)
      expect(tomarAviso('c1', 'incierto')).toMatchObject({ texto: 'No sabemos si se recibió; revisá la compra.', tono: 'advertencia' })
    })

    it('sin permiso de modificar compras no está la acción', async () => {
      mockPuedeModificar = false
      pantalla()
      await userEvent.press(await screen.findByRole('button', { name: 'Insumos del Sur SA' }))
      await screen.findByRole('button', { name: 'Confirmar compra' })
      expect(screen.queryByRole('button', { name: 'Confirmar y recibir' })).toBeNull()
    })
  })
})

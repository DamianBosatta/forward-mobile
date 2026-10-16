import React from 'react'
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CompraDetailScreen, { CompraDetalle } from '../../../../../app/(tabs)/compras/[id]'
import { AccessibilityInfo } from 'react-native'
import { confirmarYRecibir, dejarAviso } from '../../lib/confirmar-y-recibir'
import { useAuthStore } from '@/features/auth/store/auth.store'

// Tipear fechas y motivos con userEvent es lento en una corrida completa: margen para no dar falsos rojos.
jest.setTimeout(15000)

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
const mockPut = jest.fn()
const mockPostConSobre = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a), delete: (...a: unknown[]) => mockDelete(...a),
    postConSobre: (...a: unknown[]) => mockPostConSobre(...a),
  },
  API_URL: 'x',
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => mockParams }))
let mockParams: Record<string, string> = {}
let mockPermisos = ['update', 'delete']
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (_m: string, a: string) => mockPermisos.includes(a) }) }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const compra = (o: Record<string, unknown> = {}) => ({
  id: 'aaaa1111-0000', version: 3, proveedorId: 'p1', razonSocialProveedor: 'Insumos del Sur SA', depositoId: 'd', nombreDeposito: 'Depósito Central',
  fecha: '2026-10-08T01:30:00Z', estado: 'NotaPedido', subtotalBrutoAmount: 55200, descuentoTotalAmount: 0, gastosOperativos: 0, totalAmount: 55200,
  condicionPago: { tipo: 'Contado', descripcion: 'Contado' }, conFactura: false, eliminada: false,
  detalles: [{ id: 'l1', productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 1150, costoUnitarioNetoAmount: 1150, descuentoPorcentaje: 0, subtotalAmount: 55200 }],
  ...o,
})

function abrir(datos: Record<string, unknown>) {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  mockGet.mockResolvedValue(compra(datos))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><CompraDetalle id="aaaa1111-0000" /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPermisos = ['update', 'delete']
  mockParams = {}
  mockPost.mockResolvedValue(undefined)
  mockDelete.mockResolvedValue(undefined)
  mockPostConSobre.mockResolvedValue({ data: 'aaaa1111-0000', sobre: { succeeded: true, message: 'Compra confirmada. Compra recibida.' } })
  useAuthStore.setState({ user: null })
})

const conCapacidad = () => useAuthStore.setState({
  user: { ...(useAuthStore.getState().user ?? {}), permissions: [{ module: 'CAP_ANULAR_RECEPCION_COMPRAS', canRead: true }] } as never,
})

describe('detalle de compra', () => {
  it('con el número del servidor (9C), el subtítulo lo muestra como C-00232', async () => {
    abrir({ numero: 232 })
    expect(await screen.findByText('C-00232 · 07/10/2026')).toBeTruthy()
  })

  it('nota de pedido: muestra líneas y total, y confirma; si el servidor rechaza, el motivo queda a la vista', async () => {
    abrir({})
    expect(await screen.findByText('Balde Nuvia 10L')).toBeTruthy()
    expect(screen.getByText('Pendiente')).toBeTruthy()
    // 01:30 UTC del 8 es el 7 en Argentina: el día es el del servidor, no el del teléfono.
    expect(screen.getByText('AAAA1111 · 07/10/2026')).toBeTruthy()
    expect(screen.getByLabelText('Total: $ 55.200,00')).toBeTruthy()
    mockPost.mockRejectedValueOnce(Object.assign(new Error('No se le puede comprar a Insumos del Sur SA'), { status: 400 }))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar compra' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/confirmar', {})
    expect(await screen.findByText(/No se confirmó la compra: No se le puede comprar/)).toBeTruthy()
  })

  it('con el servidor que manda el descuento global, lo muestra debajo de los totales', async () => {
    abrir({ descuentoPorcentaje: 12.5, descuentoTotalAmount: 6900 })
    expect(await screen.findByText('Descuento general: 12,5 %')).toBeTruthy()
  })

  it('sin descuento global (o servidor anterior) no muestra la línea del descuento', async () => {
    abrir({ descuentoPorcentaje: 0 })
    expect(await screen.findByText('Balde Nuvia 10L')).toBeTruthy()
    expect(screen.queryByText(/Descuento general/)).toBeNull()
  })

  it('confirmada con condición por días desde la factura: recibir pide la fecha de la factura', async () => {
    abrir({ estado: 'Confirmado', condicionPago: { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' } })
    await userEvent.press(await screen.findByRole('button', { name: 'Recibir' }))
    const fecha = screen.getByLabelText('Fecha de la factura')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '31/02/2026')
    expect(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)).toBeDisabled()
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '05/10/2026')
    await userEvent.press(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)!)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/recibir', { compraId: 'aaaa1111-0000', fechaFacturaProveedor: '2026-10-05' })
  })

  it('confirmada al contado: recibir no pide fecha de factura', async () => {
    abrir({ estado: 'Confirmado' })
    await userEvent.press(await screen.findByRole('button', { name: 'Recibir' }))
    expect(screen.queryByLabelText('Fecha de la factura')).toBeNull()
    await userEvent.press(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)!)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/recibir', { compraId: 'aaaa1111-0000', fechaFacturaProveedor: null })
  })

  it('cancelar exige un motivo y lo manda al servidor', async () => {
    abrir({})
    await userEvent.press(await screen.findByRole('button', { name: 'Cancelar compra' }))
    const boton = () => screen.getAllByRole('button', { name: 'Cancelar compra' }).at(-1)!
    expect(boton()).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Motivo'), 'El proveedor no tiene stock')
    await userEvent.press(boton())
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/anular', { motivoAnulacion: 'El proveedor no tiene stock' }))
  })

  it.each(['NotaPedido', 'Confirmado'])('en %s se puede editar con el formulario nuevo', async (estado) => {
    abrir({ estado })
    await userEvent.press(await screen.findByRole('button', { name: 'Editar la compra' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/compras/nueva?edit=aaaa1111-0000')
  })

  it.each(['Entregado', 'Cancelada', 'Anulada'])('en %s no hay botón de editar', async (estado) => {
    abrir({ estado })
    await screen.findByText('Balde Nuvia 10L')
    expect(screen.queryByRole('button', { name: 'Editar la compra' })).toBeNull()
  })

  it('cada hoja arranca limpia: el motivo y el error de una no pasan a la otra', async () => {
    abrir({ estado: 'Confirmado' })
    await userEvent.press(await screen.findByRole('button', { name: 'Cancelar compra' }))
    mockDelete.mockRejectedValueOnce(Object.assign(new Error('Ya no se puede'), { status: 400 }))
    await userEvent.type(screen.getByLabelText('Motivo'), 'Cambió el pedido')
    await userEvent.press(screen.getAllByRole('button', { name: 'Cancelar compra' }).at(-1)!)
    // El error se ve una sola vez, dentro de la hoja.
    expect(await screen.findAllByText(/No se canceló la compra: Ya no se puede/)).toHaveLength(1)
    fireEvent.press(screen.getByLabelText('Cerrar', { includeHiddenElements: true }))
    await userEvent.press(screen.getByRole('button', { name: 'Recibir' }))
    expect(screen.queryByText(/No se canceló la compra/)).toBeNull()
    fireEvent.press(screen.getByLabelText('Cerrar', { includeHiddenElements: true }))
    await userEvent.press(screen.getAllByRole('button', { name: 'Cancelar compra' })[0])
    expect(screen.getByLabelText('Motivo').props.value).toBe('')
  })

  describe('comprobante del proveedor', () => {
    const SOCIO = { id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: '30-71234567-8' }
    const CARGADO = {
      id: 'k1', tipo: 'Factura', letra: 'A', puntoVenta: 2, numero: 55, fecha: '2026-10-01', periodoFiscal: 202610,
      cuitEmisor: '30712345678', razonSocialEmisor: 'Insumos del Sur SA', noGravado: 0, exento: 0, total: 1210,
      alicuotas: [{ alicuota: 'Veintiuno', netoGravado: 1000, iva: 210 }], tributos: [],
    }
    const conSocio = (datos: Record<string, unknown>) => {
      abrir(datos)
      mockGet.mockImplementation((url: string) =>
        Promise.resolve(url.startsWith('/api/v1/socios-comerciales/') ? SOCIO : compra(datos)))
    }

    it('al recibir se puede cargar el comprobante: va en el mismo POST, con el CUIT del proveedor precargado', async () => {
      conSocio({ estado: 'Confirmado' })
      await userEvent.press(await screen.findByRole('button', { name: 'Recibir' }))
      await userEvent.press(screen.getByRole('button', { name: 'Cargar el comprobante del proveedor' }))
      await waitFor(() => expect(screen.getByLabelText('CUIT del proveedor').props.value).toBe('30-71234567-8'))
      await userEvent.press(screen.getByRole('radio', { name: 'B' }))
      fireEvent.changeText(screen.getByLabelText('Punto de venta'), '3')
      fireEvent.changeText(screen.getByLabelText('Número'), '1234')
      fireEvent.changeText(screen.getByLabelText('Fecha del comprobante'), '08/10/2026')
      fireEvent.changeText(screen.getByLabelText('Total'), '55.200')
      await userEvent.press(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)!)
      expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/recibir', {
        compraId: 'aaaa1111-0000', fechaFacturaProveedor: null,
        comprobante: {
          tipo: 'Factura', letra: 'B', puntoVenta: 3, numero: 1234, fecha: '2026-10-08', cuitEmisor: '30712345678',
          razonSocialEmisor: 'Insumos del Sur SA', noGravado: 0, exento: 0, total: 55200, alicuotas: [], tributos: [],
        },
      })
    })

    it('con el comprobante a medio cargar no se recibe: dice qué falta', async () => {
      conSocio({ estado: 'Confirmado' })
      await userEvent.press(await screen.findByRole('button', { name: 'Recibir' }))
      await userEvent.press(screen.getByRole('button', { name: 'Cargar el comprobante del proveedor' }))
      await userEvent.press(screen.getAllByRole('button', { name: 'Recibir' }).at(-1)!)
      expect(await screen.findByText('Falta el punto de venta.')).toBeTruthy()
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('una recibida muestra su comprobante y se corrige con un PUT', async () => {
      mockPut.mockResolvedValue(CARGADO)
      conSocio({ estado: 'Entregado', conFactura: true, comprobante: CARGADO })
      expect(await screen.findByText('Factura A 00002-00000055')).toBeTruthy()
      await userEvent.press(screen.getByRole('button', { name: 'Corregir el comprobante' }))
      expect(screen.getByLabelText('Neto gravado').props.value).toBe('1000')
      fireEvent.changeText(screen.getByLabelText('Número'), '56')
      await userEvent.press(screen.getByRole('button', { name: 'Guardar comprobante' }))
      await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/comprobante', expect.objectContaining({
        letra: 'A', puntoVenta: 2, numero: 56, fecha: '2026-10-01', total: 1210,
        alicuotas: [{ alicuota: 'Veintiuno', netoGravado: 1000, iva: 210 }],
      })))
    })

    it('una recibida sin comprobante ofrece cargarlo; sin permiso de modificar, no', async () => {
      conSocio({ estado: 'Entregado' })
      expect(await screen.findByRole('button', { name: 'Cargar el comprobante' })).toBeTruthy()
    })

    it('sin permiso de modificar no se carga ni se corrige', async () => {
      mockPermisos = []
      conSocio({ estado: 'Entregado', conFactura: true, comprobante: CARGADO })
      expect(await screen.findByText('Factura A 00002-00000055')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /comprobante/ })).toBeNull()
    })
  })

  it('una compra recibida no se edita, no se confirma ni se cancela', async () => {
    abrir({ estado: 'Entregado', fechaVencimientoPago: '2026-11-07' })
    expect(await screen.findByText('Recibido')).toBeTruthy()
    expect(screen.getByText('Vence el 07/11/2026')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Confirmar compra|Recibir|Cancelar compra|Editar la compra/ })).toBeNull()
  })

  it('sin permiso de modificar no hay confirmar ni editar', async () => {
    mockPermisos = []
    abrir({})
    await screen.findByText('Balde Nuvia 10L')
    expect(screen.queryByRole('button', { name: 'Confirmar compra' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar la compra' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar compra' })).toBeNull()
  })

  describe('anular la recepción (PR 3.6)', () => {
    it('con MOD_COMPRAS:Delete y CAP_ANULAR_RECEPCION_COMPRAS: pide motivo y manda la versión que se estaba viendo', async () => {
      conCapacidad()
      abrir({ estado: 'Entregado' })
      await userEvent.press(await screen.findByRole('button', { name: 'Anular recepción' }))
      const boton = () => screen.getAllByRole('button', { name: 'Anular recepción' }).at(-1)!
      expect(boton()).toBeDisabled()
      mockPost.mockRejectedValueOnce(Object.assign(new Error('No alcanza el stock para descontar.'), { status: 409, errors: ['Balde Nuvia 10L: hay 10, se necesitan 48'] }))
      await userEvent.type(screen.getByLabelText('Motivo'), 'Se cargó dos veces')
      await userEvent.press(boton())
      expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/aaaa1111-0000/anular-recepcion', { compraId: 'aaaa1111-0000', motivo: 'Se cargó dos veces', version: 3 })
      expect((await screen.findAllByText(/No se anuló la recepción: No alcanza el stock para descontar\.\s+Balde Nuvia 10L: hay 10, se necesitan 48/)).length).toBeGreaterThan(0)
    })

    it.each([
      ['sin la capacidad', false, ['update', 'delete']],
      ['sin permiso de borrar en compras', true, ['update']],
    ])('%s no aparece', async (_caso, capacidad, permisos) => {
      if (capacidad) conCapacidad()
      mockPermisos = permisos as string[]
      abrir({ estado: 'Entregado' })
      await screen.findByText('Recibido')
      expect(screen.queryByRole('button', { name: 'Anular recepción' })).toBeNull()
    })

    it('anular arranca sin el motivo ni el error de antes y, tras un 409, manda la versión vigente', async () => {
      conCapacidad()
      abrir({ estado: 'Entregado' })
      await userEvent.press(await screen.findByRole('button', { name: 'Anular recepción' }))
      mockPost.mockRejectedValueOnce(Object.assign(new Error('Error de concurrencia'), { status: 409 }))
      await userEvent.type(screen.getByLabelText('Motivo'), 'Se cargó dos veces')
      mockGet.mockResolvedValue(compra({ estado: 'Entregado', version: 4 }))
      await userEvent.press(screen.getAllByRole('button', { name: 'Anular recepción' }).at(-1)!)
      expect(await screen.findAllByText(/No se anuló la recepción: Error de concurrencia/)).toHaveLength(1)
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(1))
      await userEvent.press(screen.getAllByRole('button', { name: 'Anular recepción' }).at(-1)!)
      await waitFor(() => expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Compras/aaaa1111-0000/anular-recepcion', { compraId: 'aaaa1111-0000', motivo: 'Se cargó dos veces', version: 4 }))
      // Salió bien: la hoja se cerró; al abrirla otra vez no queda el motivo anterior.
      await userEvent.press(await screen.findByRole('button', { name: 'Anular recepción' }))
      expect(screen.getByLabelText('Motivo').props.value).toBe('')
    })

    it('una compra por recibir no se anula: se cancela', async () => {
      conCapacidad()
      abrir({ estado: 'Confirmado' })
      await screen.findByRole('button', { name: 'Recibir' })
      expect(screen.queryByRole('button', { name: 'Anular recepción' })).toBeNull()
    })
  })

  describe('confirmar y recibir desde la nota de pedido', () => {
    const URL_CYR = '/api/v1/Compras/aaaa1111-0000/confirmar-y-recibir'
    const enviar = () => userEvent.press(screen.getAllByRole('button', { name: 'Confirmar y recibir' }).at(-1)!)

    it('una sola llamada con la versión vista y la fecha de factura; muestra el mensaje del servidor y recarga', async () => {
      abrir({ condicionPago: { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' } })
      await userEvent.press(await screen.findByRole('button', { name: 'Confirmar y recibir' }))
      fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
      mockGet.mockClear()
      await enviar()
      expect(mockPostConSobre).toHaveBeenCalledWith(URL_CYR, { version: 3, fechaFacturaProveedor: '2026-10-05' })
      expect(await screen.findByText('Compra confirmada. Compra recibida.')).toBeTruthy()
      await waitFor(() => expect(mockGet).toHaveBeenCalled())
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('409 CompraYaRecibida: avisa que ya quedó recibida, sin error', async () => {
      mockPostConSobre.mockRejectedValue(Object.assign(new Error('La compra ya fue recibida.'), { status: 409, codigo: 'CompraYaRecibida' }))
      abrir({})
      await userEvent.press(await screen.findByRole('button', { name: 'Confirmar y recibir' }))
      expect(screen.queryByLabelText('Fecha de la factura')).toBeNull()
      await enviar()
      expect(await screen.findByText('La compra ya quedó recibida.')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('un 400 queda en la hoja con el motivo del servidor', async () => {
      mockPostConSobre.mockRejectedValue(Object.assign(new Error('Falta la fecha de la factura del proveedor.'), { status: 400 }))
      abrir({})
      await userEvent.press(await screen.findByRole('button', { name: 'Confirmar y recibir' }))
      await enviar()
      expect(await screen.findByText('Falta la fecha de la factura del proveedor.')).toBeTruthy()
      expect(screen.getByLabelText('Confirmar y recibir la compra')).toBeTruthy()
    })

    it('sin respuesta (red): no dice que no se hizo, pide revisar la compra', async () => {
      mockPostConSobre.mockRejectedValue(new TypeError('Network request failed'))
      abrir({})
      await userEvent.press(await screen.findByRole('button', { name: 'Confirmar y recibir' }))
      await enviar()
      expect(await screen.findByText('No sabemos si se recibió; revisá la compra.')).toBeTruthy()
    })

    it('anuncia el resultado a los lectores de pantalla', async () => {
      const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      abrir({})
      await userEvent.press(await screen.findByRole('button', { name: 'Confirmar y recibir' }))
      await enviar()
      await waitFor(() => expect(anuncio).toHaveBeenCalledWith('Compra confirmada. Compra recibida.'))
    })

    it('mientras está en curso la hoja no se cierra', async () => {
      mockPostConSobre.mockReturnValue(new Promise(() => {}))
      abrir({})
      await userEvent.press(await screen.findByRole('button', { name: 'Confirmar y recibir' }))
      await enviar()
      fireEvent(screen.getByLabelText('Confirmar y recibir la compra'), 'accessibilityEscape')
      expect(screen.getByLabelText('Confirmar y recibir la compra')).toBeTruthy()
    })

    it('si tras un 409 la compra ya no es nota de pedido, cierra la hoja y deja el motivo a la vista', async () => {
      mockPostConSobre.mockRejectedValue(Object.assign(new Error('La compra no está en nota de pedido.'), { status: 409 }))
      abrir({})
      await userEvent.press(await screen.findByRole('button', { name: 'Confirmar y recibir' }))
      mockGet.mockResolvedValue(compra({ estado: 'Cancelado' }))
      await enviar()
      expect(await screen.findByText('La compra no está en nota de pedido.')).toBeTruthy()
      await waitFor(() => expect(screen.queryByLabelText('Confirmar y recibir la compra') === null).toBe(true))
    })

    describe('al llegar desde la compra nueva', () => {
      function ruta(aviso: string) {
        mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
        mockParams = { id: 'aaaa1111-0000', aviso }
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={qc}><CompraDetailScreen /></QueryClientProvider>)
      }

      it('sin red el aviso "no sabemos" se ve aunque la compra no cargue', async () => {
        mockPostConSobre.mockRejectedValue(new TypeError('Network request failed'))
        const r = await confirmarYRecibir('aaaa1111-0000', {})
        if (r.tipo === 'hecho') dejarAviso('aaaa1111-0000', r.aviso)
        mockGet.mockRejectedValue(new TypeError('Network request failed'))
        ruta('incierto')
        expect(await screen.findByText('No sabemos si se recibió; revisá la compra.')).toBeTruthy()
        expect(await screen.findByText('Network request failed')).toBeTruthy()
      })

      it('un enlace con ?aviso= solo no muestra un éxito que no pasó', async () => {
        mockGet.mockResolvedValue(compra({}))
        ruta('recibida')
        await screen.findByText('Balde Nuvia 10L')
        expect(screen.queryByText(/recibida/)).toBeNull()
      })
    })

    it('una compra ya confirmada no la ofrece: se recibe', async () => {
      abrir({ estado: 'Confirmado' })
      await screen.findByRole('button', { name: 'Recibir' })
      expect(screen.queryByRole('button', { name: 'Confirmar y recibir' })).toBeNull()
    })

    it('sin permiso de modificar no está', async () => {
      mockPermisos = ['delete']
      abrir({})
      await screen.findByRole('button', { name: 'Cancelar compra' })
      expect(screen.queryByRole('button', { name: 'Confirmar y recibir' })).toBeNull()
    })
  })
})

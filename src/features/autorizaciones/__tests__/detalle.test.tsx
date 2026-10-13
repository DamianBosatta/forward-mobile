import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { AVISO_DEUDA_VENCIDA } from '@/features/clientes/components/CreditoDelCliente'
import { DetalleAutorizacion } from '../components/DetalleAutorizacion'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body: unknown) => mockPost(url, body) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

const VENTA = {
  venta: {
    id: 'v1', codigoPedido: 'A00428', estado: 9, version: 42, clienteNombre: 'Gral. Paz 10450 - Limpieza Total', vendedorNombre: 'Lucía Ferreyra',
    totalAmount: 336076.11, subtotalBrutoAmount: 331788.96, montoDescuentoAmount: 0, cargoFleteAmount: 4287.15,
    motivoPendienteAutorizacion: 2 | 1, motivoVentaSinStock: 'Entra el martes', gananciaBrutaAmount: null, margenBrutoPorcentaje: null,
  },
  detalles: [{ id: 'd1', productoNombre: 'Detergente Magistral', cantidad: 24, precioUnitario: 2323.2, subtotal: 55756.8, porcentajeDescuentoItem: 12 }],
}
const PREVIEW = {
  ventaId: 'v1', totalSacrificio: 0, valorStockLiberado: 0,
  items: [{ detalleId: 'd1', productoId: 'p1', productoNombre: 'Detergente Magistral', cantidad: 24, precioEfectivo: 2323.2, precioMinimoRentable: 2420, aporteOverhead: null, sacrificio: 96.8 }],
}

function permisos(...modulos: string[]) {
  useAuthStore.setState({ user: { id: 'u1', username: 'marina', roles: [], permissions: modulos.map((module) => ({ module, canRead: true })) } } as never)
}

function pintar(venta: object = VENTA) {
  mockGet.mockImplementation((url: string) => Promise.resolve(url.endsWith('autorizacion-preview') ? PREVIEW : venta))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue(true)
})

describe('Autorizar venta: el detalle', () => {
  it('muestra todos los motivos y el del vendedor, las líneas y los totales', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    pintar()
    expect(await screen.findByText('Autorizar A00428')).toBeTruthy()
    expect(screen.getByText(/margen en amarillo/)).toBeTruthy()
    expect(screen.getByText(/Falta stock/)).toBeTruthy()
    expect(screen.getByText('Motivo del vendedor: «Entra el martes»')).toBeTruthy()
    expect(screen.getByText('24 × $ 2.323,20 · Desc. 12,0 %')).toBeTruthy()
    expect(screen.getByLabelText('Flete: $ 4.287,15')).toBeTruthy()
  })

  it('sin CAP_VER_COSTOS no hay costos ni se pide la vista previa', async () => {
    permisos('MOD_VENTAS', 'MOD_REPORTES', 'CAP_AUTORIZAR_VENTA')
    pintar()
    await screen.findByText('Autorizar A00428')
    expect(screen.queryByTestId('bloque-costos')).toBeNull()
    expect(screen.queryByText(/Ganancia bruta|Aporte|Sacrificio/)).toBeNull()
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('autorizacion-preview'))).toBe(false)
  })

  it('con CAP_VER_COSTOS, lo que el servidor manda en null se ve "—", nunca "$ 0"', async () => {
    permisos('MOD_VENTAS', 'MOD_REPORTES', 'CAP_AUTORIZAR_VENTA', 'CAP_VER_COSTOS')
    pintar()
    const bloque = await screen.findByTestId('bloque-costos')
    expect(await within(bloque).findByText('Aporte — · Sacrificio $ 96,80')).toBeTruthy()
    expect(within(bloque).getAllByText('—')).toHaveLength(2) // ganancia y margen de la venta
    expect(within(bloque).queryByText(/\$ 0,00/)).toBeNull()
  })

  it('con CAP_VER_COSTOS pero sin Reportes no pide la vista previa (el servidor daría 403)', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA', 'CAP_VER_COSTOS')
    pintar()
    await screen.findByTestId('bloque-costos')
    expect(mockGet.mock.calls.some(([u]) => String(u).includes('autorizacion-preview'))).toBe(false)
  })

  it('con margen en amarillo autorizar exige la razón y la manda con la versión del detalle', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja = within(screen.getByLabelText('Autorizar venta'))
    expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBe(true)

    await userEvent.type(hoja.getByLabelText('Razón para autorizar · obligatoria'), 'Cliente estratégico')
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 42, razon: 'Cliente estratégico' })
    expect(mockBack).toHaveBeenCalled()
  })

  describe('descuento adicional al autorizar (opcional)', () => {
    const SIN_AMARILLO = { ...VENTA, venta: { ...VENTA.venta, motivoPendienteAutorizacion: 1 } }
    async function abrirHoja() {
      permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
      pintar(SIN_AMARILLO)
      await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
      const hoja = within(screen.getByLabelText('Autorizar venta'))
      await waitFor(() => expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
      return hoja
    }

    it('se manda en el pedido de autorizar, con coma o punto decimal', async () => {
      const hoja = await abrirHoja()
      expect(hoja.getByText(/No cambia la comisión del vendedor/)).toBeTruthy()
      await userEvent.type(hoja.getByLabelText('Descuento adicional al autorizar (opcional)'), '5,25')
      await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
      expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 42, razon: null, descuentoAdicionalPorcentaje: 5.25 })
    })

    it.each([['12,345', 'hasta 2 decimales'], ['150', 'entre 0 y 100'], ['abc', 'Escribí un número']])(
      '"%s" no se manda: avisa (%s) y no deja autorizar',
      async (texto, aviso) => {
        const hoja = await abrirHoja()
        await userEvent.type(hoja.getByLabelText('Descuento adicional al autorizar (opcional)'), texto)
        expect(hoja.getByLabelText('Descuento adicional al autorizar (opcional)').props.accessibilityHint).toMatch(aviso)
        expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBe(true)
        await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
        expect(mockPost).not.toHaveBeenCalled()
      },
    )

    it('con descuento, la razón avisa que el piso la puede volver obligatoria', async () => {
      const hoja = await abrirHoja()
      const aviso = 'Si el descuento deja líneas por debajo del piso, la razón es obligatoria.'
      expect(hoja.queryByText(aviso)).toBeNull()
      await userEvent.type(hoja.getByLabelText('Descuento adicional al autorizar (opcional)'), '5')
      expect(hoja.getByText(aviso)).toBeTruthy()
      expect(hoja.getByLabelText('Razón para autorizar (opcional)').props.accessibilityHint).toBe(aviso)
    })

    it('vacío o en 0 no se manda el campo (sin descuento adicional)', async () => {
      const hoja = await abrirHoja()
      await userEvent.type(hoja.getByLabelText('Descuento adicional al autorizar (opcional)'), '0')
      await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
      expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 42, razon: null })
    })
  })

  it('si la venta ya no espera autorización, no ofrece decidir', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    pintar({ ...VENTA, venta: { ...VENTA.venta, estado: 2 } })
    expect(await screen.findByText('Esta venta ya no espera autorización.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Autorizar' })).toBeNull()
  })

  it('sin CAP_AUTORIZAR_VENTA (entrando por un enlace) el detalle es de solo lectura', async () => {
    permisos('MOD_VENTAS')
    pintar()
    expect(await screen.findByText(/necesitás el permiso de autorizar ventas/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Autorizar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull()
  })

  it('al abrir la decisión vuelve a pedir la venta y manda la versión nueva, no la cacheada', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    let pedidos = 0
    mockGet.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('autorizacion-preview') ? PREVIEW : { ...VENTA, venta: { ...VENTA.venta, version: 42 + pedidos++ } }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja = within(screen.getByLabelText('Autorizar venta'))
    await userEvent.type(hoja.getByLabelText('Razón para autorizar · obligatoria'), 'ok')
    await waitFor(() => expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 43, razon: 'ok' })
  })

  it('tras un 409 vuelve a pedir la venta y el reintento manda la versión nueva', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    let version = 42
    mockGet.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('autorizacion-preview') ? PREVIEW : { ...VENTA, venta: { ...VENTA.venta, version } }))
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Conflicto: el dato fue modificado por otro usuario.'), { status: 409 }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja = within(screen.getByLabelText('Autorizar venta'))
    await userEvent.type(hoja.getByLabelText('Razón para autorizar · obligatoria'), 'ok')
    await waitFor(() => expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
    version = 44 // otro usuario editó la venta
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))
    // Un 409 real del servidor cierra la hoja y avisa en el detalle, igual que la guarda local.
    expect(await screen.findByText(/Otra persona modificó o resolvió esta venta/)).toBeTruthy()
    expect(screen.queryByLabelText('Autorizar venta')).toBeNull()

    await waitFor(() => expect(mockGet.mock.calls.filter(([u]) => u === '/api/v1/Ventas/v1').length).toBeGreaterThanOrEqual(3))
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja2 = within(screen.getByLabelText('Autorizar venta'))
    await userEvent.type(hoja2.getByLabelText('Razón para autorizar · obligatoria'), 'ok')
    await waitFor(() => expect(hoja2.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
    await userEvent.press(hoja2.getByRole('button', { name: 'Autorizar' }))
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Ventas/v1/autorizar', { ventaId: 'v1', version: 44, razon: 'ok' })
  })

  describe('el cliente: condición de pago, saldo y vencido (de la ficha del cliente)', () => {
    const CON_CLIENTE = { ...VENTA, venta: { ...VENTA.venta, clienteId: 'c1' } }
    const FICHA = '/api/v1/socios-comerciales/c1'
    const SOCIO = {
      id: 'c1', razonSocial: 'Limpieza Total SRL', puedeVerSaldo: true, saldoAmount: 450000,
      condicionPago: { tipo: 'DiasDesdeEntrega', dias: 30 },
      deudaVencidaAmount: 120000, deudaVencidaTstAmount: 0, deudaVencidaNormalAmount: 120000, creditoDisponible: -50000,
    }
    const pedidos = (url: string) => mockGet.mock.calls.filter(([u]) => String(u).includes(url))

    function pintarConCliente(ficha: () => Promise<unknown>, ...modulos: string[]) {
      permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA', ...(modulos.length ? modulos : ['MOD_CLIENTES']))
      mockGet.mockImplementation((url: string) => {
        if (url.endsWith('autorizacion-preview')) return Promise.resolve(PREVIEW)
        if (url.includes('socios-comerciales')) return ficha()
        return Promise.resolve(CON_CLIENTE)
      })
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      return render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
    }
    const botonesUsables = async () => {
      for (const name of ['Autorizar', 'Rechazar']) {
        const boton = await screen.findByRole('button', { name })
        expect(boton.props.accessibilityState?.disabled).toBeFalsy()
      }
    }

    it('muestra condición de pago, saldo, vencido y disponible del servidor, sin el aviso de pedidos nuevos', async () => {
      pintarConCliente(() => Promise.resolve(SOCIO))
      const bloque = await screen.findByTestId('bloque-cliente')
      expect(within(bloque).getByLabelText('Condición de pago: Cuenta corriente, 30 días desde la entrega')).toBeTruthy()
      expect(within(bloque).getByLabelText('Saldo: $ 450.000,00')).toBeTruthy()
      expect(within(bloque).getByLabelText('Vencido (más de 30 días): $ 120.000,00 · Normal')).toBeTruthy()
      expect(within(bloque).getByLabelText('Disponible: Pasado del tope por $ 50.000,00')).toBeTruthy()
      // La venta ya está por autorizar: el aviso "los pedidos nuevos van a quedar por autorizar" no corresponde.
      expect(within(bloque).queryByText(AVISO_DEUDA_VENCIDA)).toBeNull()
      expect(pedidos(FICHA)).toHaveLength(1)
      await botonesUsables()
    })

    it('sin deuda vencida y con tope, muestra el disponible y no inventa un vencido', async () => {
      pintarConCliente(() => Promise.resolve({ ...SOCIO, deudaVencidaAmount: 0, creditoDisponible: 80000 }))
      const bloque = await screen.findByTestId('bloque-cliente')
      expect(within(bloque).getByLabelText('Disponible: $ 80.000,00')).toBeTruthy()
      expect(within(bloque).queryByText(/Vencido/)).toBeNull()
    })

    it('si el servidor redacta los importes (puedeVerSaldo false) solo queda la condición de pago, nunca "$ 0"', async () => {
      pintarConCliente(() => Promise.resolve({
        ...SOCIO, puedeVerSaldo: false, saldoAmount: 0, deudaVencidaAmount: 0, deudaVencidaNormalAmount: 0, creditoDisponible: 0,
      }))
      const bloque = await screen.findByTestId('bloque-cliente')
      expect(within(bloque).getByLabelText('Condición de pago: Cuenta corriente, 30 días desde la entrega')).toBeTruthy()
      expect(within(bloque).queryByText(/Saldo|Vencido|Disponible/)).toBeNull()
      expect(within(bloque).queryByText(/\$ /)).toBeNull()
    })

    it('con un servidor anterior (sin vencido ni disponible) muestra lo que hay y no falla', async () => {
      const { deudaVencidaAmount, deudaVencidaTstAmount, deudaVencidaNormalAmount, creditoDisponible, ...anterior } = SOCIO
      void [deudaVencidaAmount, deudaVencidaTstAmount, deudaVencidaNormalAmount, creditoDisponible]
      pintarConCliente(() => Promise.resolve(anterior))
      const bloque = await screen.findByTestId('bloque-cliente')
      expect(within(bloque).getByLabelText('Saldo: $ 450.000,00')).toBeTruthy()
      expect(within(bloque).queryByText(/Vencido|Disponible/)).toBeNull()
    })

    it('sin tope (disponible null) ni condición cargada: no hay Disponible y la condición es Contado', async () => {
      pintarConCliente(() => Promise.resolve({ ...SOCIO, creditoDisponible: null, deudaVencidaAmount: 0, condicionPago: null }))
      const bloque = await screen.findByTestId('bloque-cliente')
      expect(within(bloque).getByLabelText('Condición de pago: Contado')).toBeTruthy()
      expect(within(bloque).queryByText(/Disponible/)).toBeNull()
    })

    it('si el servidor ni manda puedeVerSaldo (muy anterior), no muestra importes que podrían estar redactados', async () => {
      const { puedeVerSaldo, ...sinFlag } = SOCIO
      void puedeVerSaldo
      pintarConCliente(() => Promise.resolve(sinFlag))
      const bloque = await screen.findByTestId('bloque-cliente')
      expect(within(bloque).queryByText(/Saldo|Vencido|Disponible/)).toBeNull()
    })

    it.each([[403, 'No tenés permisos para esta acción.'], [404, 'No encontrado']])(
      'si la ficha da %s no muestra nada y el resto del detalle y los botones siguen',
      async (status, mensaje) => {
        pintarConCliente(() => Promise.reject(Object.assign(new Error(mensaje), { status })))
        await waitFor(() => expect(pedidos(FICHA)).toHaveLength(1))
        expect(await screen.findByText('Autorizar A00428')).toBeTruthy()
        expect(screen.getByText(/Falta stock/)).toBeTruthy()
        await botonesUsables()
        await waitFor(() => expect(screen.queryByTestId('bloque-cliente')).toBeNull())
        expect(screen.queryByText(mensaje)).toBeNull()
      },
    )

    it('mientras la ficha carga no hay bloque y los botones se pueden usar; al llegar aparece sin tocarlos', async () => {
      let llega: (socio: object) => void = () => {}
      pintarConCliente(() => new Promise((resolver) => { llega = resolver }))
      await botonesUsables()
      expect(screen.queryByTestId('bloque-cliente')).toBeNull()
      await userEvent.press(screen.getByRole('button', { name: 'Rechazar' }))
      expect(screen.getByLabelText('Rechazar venta')).toBeTruthy()

      llega(SOCIO)
      expect(await screen.findByTestId('bloque-cliente')).toBeTruthy()
      expect(screen.getByLabelText('Rechazar venta')).toBeTruthy()
    })

    it('sin Clientes:Read no pide la ficha (el servidor daría 403) y el detalle queda igual', async () => {
      pintarConCliente(() => Promise.resolve(SOCIO), 'MOD_REPORTES')
      await botonesUsables()
      expect(pedidos('socios-comerciales')).toHaveLength(0)
      expect(screen.queryByTestId('bloque-cliente')).toBeNull()
    })

    it('si la venta no trae clienteId no pide ninguna ficha', async () => {
      permisos('MOD_VENTAS', 'MOD_CLIENTES', 'CAP_AUTORIZAR_VENTA')
      pintar()
      await botonesUsables()
      expect(pedidos('socios-comerciales')).toHaveLength(0)
      expect(screen.queryByTestId('bloque-cliente')).toBeNull()
    })
  })

  it('tras un 409, si la venta ya no espera autorización, no quedan los botones de decidir', async () => {
    permisos('MOD_VENTAS', 'CAP_AUTORIZAR_VENTA')
    let estado = 9
    mockGet.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('autorizacion-preview') ? PREVIEW : { ...VENTA, venta: { ...VENTA.venta, estado } }))
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Conflicto'), { status: 409 }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><DetalleAutorizacion id="v1" /></QueryClientProvider>)
    await userEvent.press(await screen.findByRole('button', { name: 'Autorizar' }))
    const hoja = within(screen.getByLabelText('Autorizar venta'))
    await userEvent.type(hoja.getByLabelText('Razón para autorizar · obligatoria'), 'ok')
    await waitFor(() => expect(hoja.getByRole('button', { name: 'Autorizar' }).props.accessibilityState.disabled).toBeFalsy())
    estado = 2 // otro usuario la resolvió
    await userEvent.press(hoja.getByRole('button', { name: 'Autorizar' }))

    expect(await screen.findByText('Esta venta ya no espera autorización.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Autorizar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull()
  })
})

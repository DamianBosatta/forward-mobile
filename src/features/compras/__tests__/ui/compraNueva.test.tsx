import React from 'react'
import { fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraNueva } from '../../components/CompraNueva'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
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
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack }) }))
let mockPuedeModificar = true
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (m: string, a: string) => mockPuedeModificar && m === 'MOD_COMPRAS' && a === 'update' }) }))

let mockConectado: boolean | null = true
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockConectado }) }))

const ESPERA = { timeout: 3000 }
const COMPLETO = { id: 'p1', razonSocial: 'Insumos del Sur SA', requiereCompletar: false }
const INCOMPLETO = { id: 'p2', razonSocial: 'Gorrión Mayorista', requiereCompletar: true }

let mockCondicion: { tipo: string; dias: number; descripcion: string } | undefined
function socio(id: string) {
  return id === 'p2'
    ? { id, razonSocial: 'Gorrión Mayorista', condicionesDeCompraFaltantes: ['condición de pago', 'franja de entrega'] }
    : { id, razonSocial: 'Insumos del Sur SA', cuit: '30-12345678-9', condicionPago: mockCondicion, condicionesDeCompraFaltantes: [] }
}

function pantalla(props: { borradorId?: string; editarId?: string; proveedorId?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><CompraNueva {...props} /></QueryClientProvider>)
}

const puts = () => mockPut.mock.calls.map(([, body]) => body as { detalles: { costoUnitario: number; cantidad: number; unidadCompra: string }[] })

beforeEach(() => {
  jest.clearAllMocks()
  mockPuedeModificar = true
  mockConectado = true
  mockCondicion = { tipo: 'DiasDesdeEntrega', dias: 30, descripcion: '30 días' }
  mockPostConSobre.mockResolvedValue({ data: 'c1', sobre: { succeeded: true, message: 'Compra confirmada. Compra recibida.' } })
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return Promise.resolve({ items: [COMPLETO, INCOMPLETO], totalCount: 2 })
    if (url.startsWith('/api/v1/socios-comerciales/')) return Promise.resolve(socio(url.split('/').pop()!))
    if (url.startsWith('/api/v1/Productos/catalogo-stock?')) return Promise.resolve({ items: [{ id: 'pr1', nombre: 'Balde Nuvia 10L' }], page: 1, totalCount: 1, hasNextPage: false })
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

async function elegirProveedor(nombre = 'Insumos del Sur SA') {
  await userEvent.press(await screen.findByRole('radio', { name: nombre }, ESPERA))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar a productos' })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: 'Continuar a productos' }))
  await screen.findByText('Paso 2 de 4', {}, ESPERA)
}
async function agregarBalde() {
  await userEvent.press(await screen.findByRole('button', { name: 'Agregar Balde Nuvia 10L' }, ESPERA))
  // Se precarga el último costo de la ficha.
  await screen.findByText(/por unidad/, {}, ESPERA)
}
const verCompra = () => userEvent.press(screen.getByRole('button', { name: 'Ver compra' }))
const continuar = async () => {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('Paso 4 de 4', {}, ESPERA)
}
async function hastaRecepcion() {
  pantalla()
  await elegirProveedor()
  await agregarBalde()
  await verCompra()
  await continuar()
}

describe('pasos de la compra nueva (maqueta "Compras como venta")', () => {
  it('va Proveedor → Productos → Carrito → Recepción, con "Paso N de 4", y vuelve atrás por los mismos pasos', async () => {
    pantalla()
    expect(await screen.findByText('Paso 1 de 4')).toBeTruthy()
    await elegirProveedor()
    expect(screen.getByLabelText('Paso 2 de 4: Productos')).toHaveProp('accessibilityState', { selected: true })
    await agregarBalde()
    expect(screen.getByText('1 producto · 1 u')).toBeTruthy()
    await verCompra()
    expect(screen.getByLabelText('Paso 3 de 4: Carrito')).toHaveProp('accessibilityState', { selected: true })
    await continuar()
    expect(screen.getByLabelText('Paso 4 de 4: Recepción')).toHaveProp('accessibilityState', { selected: true })
    await userEvent.press(screen.getByRole('link', { name: 'Volver al carrito' }))
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
    await userEvent.press(screen.getByRole('link', { name: 'Editar los productos' }))
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy()
  })

  it('a un proveedor sin condición de pago o franja no se le compra: aviso y no se crea el borrador', async () => {
    pantalla()
    await userEvent.press(await screen.findByRole('radio', { name: /Gorrión Mayorista/ }))
    expect(await screen.findByText(/le falta condición de pago y franja de entrega/, {}, ESPERA)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar a productos' })).toBeDisabled()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('el catálogo pide al servidor lo comprable: fragancias incluidas, sin la línea, y nunca GET /Productos', async () => {
    pantalla()
    await elegirProveedor()
    await screen.findByRole('button', { name: 'Agregar Balde Nuvia 10L' }, ESPERA)
    const urls = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Productos/catalogo-stock?'))
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every((u) => new URLSearchParams(u.split('?')[1]).get('soloComprables') === 'true')).toBe(true)
    expect(urls.every((u) => new URLSearchParams(u.split('?')[1]).get('familiasCompletas') === 'false')).toBe(true)
    expect(urls.every((u) => !new URLSearchParams(u.split('?')[1]).has('sinVariantes'))).toBe(true)
    // `GET /Productos` no filtra por depósito: ahí aparecería un producto solo del Central con stock disponible.
    expect(mockGet.mock.calls.map(([u]) => String(u)).some((u) => u.startsWith('/api/v1/Productos?'))).toBe(false)
    expect(screen.getByText('Mostrando 1 de 1')).toBeTruthy()
    expect(screen.getByText('Insumos del Sur SA')).toBeTruthy()
    expect(screen.getByText('Plazo de pago 30 días')).toBeTruthy()
  })

  it('sin conexión el catálogo lo dice y se sigue cargando', async () => {
    mockConectado = false
    pantalla()
    await elegirProveedor()
    expect(await screen.findByLabelText('Estado: Sin conexión', {}, ESPERA)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Agregar Balde Nuvia 10L' }, ESPERA)).toBeTruthy()
  })

  it('quien ve todos los depósitos no manda depósito al catálogo', async () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'u', roles: ['Admin'] as never, depositoId: DEPOSITO_CENTRAL_ID, permissions: [{ module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true }] as never } })
    pantalla()
    await elegirProveedor()
    await screen.findByRole('button', { name: 'Agregar Balde Nuvia 10L' }, ESPERA)
    const urls = mockGet.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/v1/Productos/catalogo-stock?'))
    expect(urls.every((u) => !new URLSearchParams(u.split('?')[1]).has('depositoId'))).toBe(true)
  })
})

describe('catálogo y carrito', () => {
  it('"Agregar" suma el producto con el último costo; −/+ cambian la cantidad y el − en el último lo quita', async () => {
    pantalla()
    await elegirProveedor()
    await agregarBalde()
    const tarjeta = screen.getByTestId('producto-pr1')
    expect(within(tarjeta).getByText(/1 u/)).toBeTruthy()
    await userEvent.press(within(tarjeta).getByRole('button', { name: 'Sumar Balde Nuvia 10L' }))
    expect(within(tarjeta).getByLabelText('Cantidad de Balde Nuvia 10L: 2')).toBeTruthy()
    await waitFor(() => expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 2, costoUnitario: 1020 }), ESPERA)
    await userEvent.press(within(tarjeta).getByRole('button', { name: 'Restar Balde Nuvia 10L' }))
    await userEvent.press(within(tarjeta).getByRole('button', { name: 'Restar Balde Nuvia 10L' }))
    expect(await screen.findByRole('button', { name: 'Agregar Balde Nuvia 10L' })).toBeTruthy()
  })

  it('una línea sin costo dice "Falta el costo" en la tarjeta y en el carrito; se carga en "Cantidad y costo"', async () => {
    pantalla({ borradorId: 'b9' })
    expect(await screen.findByText('Falta el costo', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Subtotal (falta un costo)')).toBeTruthy()
    // El filtro "Sin costo cargado" la deja a la vista.
    await userEvent.press(screen.getByRole('radio', { name: 'Sin costo cargado' }))
    expect(screen.getByTestId('producto-pr1')).toBeTruthy()
    await verCompra()
    expect(screen.getByText('Falta el costo.')).toBeTruthy()
    expect(screen.getByText(/Una línea no tiene costo/)).toBeTruthy()
    expect(screen.getByText('Cargar el costo')).toBeTruthy()
    expect(screen.getByLabelText('Total sin calcular')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Cantidad y costo de Balde Nuvia 10L' }))
    await userEvent.type(screen.getByLabelText('Costo por unidad ($)'), '1.150,50')
    await userEvent.press(screen.getByRole('button', { name: 'Listo, seguir cargando' }))
    expect(screen.queryByText('Falta el costo.')).toBeNull()
    await waitFor(() => expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 4, costoUnitario: 1150.5, unidadCompra: 'Bulto' }), ESPERA)
  })

  it('el carrito muestra marca y código de cada producto y los gastos operativos van al borrador', async () => {
    mockGet.mockImplementation(((orig) => (url: string) => (url === '/api/v1/Productos/pr1' ? Promise.resolve({ id: 'pr1', precioCompraBase: 1020, marca: 'Nuvia', codigoPropio: 'BAL-10' }) : orig(url)))(mockGet.getMockImplementation()!))
    pantalla()
    await elegirProveedor()
    await agregarBalde()
    await verCompra()
    expect(await screen.findByText('Nuvia')).toBeTruthy()
    expect(screen.getByText('BAL-10')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Gastos operativos ($)'), '500')
    await waitFor(() => expect(mockPut.mock.calls.at(-1)?.[1]).toMatchObject({ gastosOperativos: 500 }), ESPERA)
  })
})

describe('paso 4: recepción', () => {
  const URL_CYR = '/api/v1/Compras/c1/confirmar-y-recibir'
  const prender = () => userEvent.press(screen.getByRole('switch', { name: 'Recibir ahora' }))

  it('el interruptor "Recibir ahora" cambia el botón a "Confirmar y recibir" y apagado vuelve a "Confirmar compra"', async () => {
    await hastaRecepcion()
    expect(screen.getByRole('switch', { name: 'Recibir ahora' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: false }))
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeTruthy()
    expect(screen.queryByText('Factura del proveedor')).toBeNull()
    await prender()
    expect(screen.getByRole('switch', { name: 'Recibir ahora' })).toHaveProp('accessibilityState', expect.objectContaining({ checked: true }))
    expect(screen.getByRole('button', { name: 'Confirmar y recibir' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar compra' })).toBeNull()
    expect(screen.getByText('Factura del proveedor')).toBeTruthy()
    await prender()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeTruthy()
  })

  it('sin permiso de modificar compras no hay interruptor: solo "Confirmar compra"', async () => {
    mockPuedeModificar = false
    await hastaRecepcion()
    expect(screen.queryByRole('switch', { name: 'Recibir ahora' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeTruthy()
  })

  it('muestra el proveedor con su CUIT y plazo; "Confirmar compra" guarda lo pendiente, confirma y abre "Compra guardada"', async () => {
    await hastaRecepcion()
    expect(await screen.findByText('CUIT 30-12345678-9', {}, ESPERA)).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar compra' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/c1/confirmar', { compraId: 'c1' }), ESPERA)
    expect(puts().at(-1)?.detalles[0]).toMatchObject({ cantidad: 1, costoUnitario: 1020 })
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/guardada?id=c1')
  })

  it('"Guardar nota de pedido" guarda la nota y abre "Compra guardada"', async () => {
    await hastaRecepcion()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar nota de pedido' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/guardada?id=c1'), ESPERA)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/c1/guardar-nota-pedido', expect.anything())
  })

  it('un rechazo al confirmar queda arriba con el motivo del servidor y no sale de la pantalla', async () => {
    await hastaRecepcion()
    mockPost.mockImplementation((url: string) => (url.endsWith('/confirmar') ? Promise.reject(Object.assign(new Error('Sin stock virtual.'), { status: 400 })) : Promise.resolve(undefined)))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar compra' }))
    expect(await screen.findByText(/No se confirmó la compra: Sin stock virtual\./, {}, ESPERA)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('con un costo faltante: aviso rojo, "Ir al carrito" y no se confirma ni se guarda la nota', async () => {
    pantalla({ borradorId: 'b9' })
    await screen.findByText('Falta el costo', {}, ESPERA)
    await verCompra()
    await continuar()
    expect(screen.getByText('Falta el costo.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar nota de pedido' })).toBeDisabled()
    await userEvent.press(screen.getByRole('link', { name: 'Ir al carrito' }))
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
  })

  it('confirmar y recibir: UNA llamada con la versión del guardado y la fecha de factura; abre "Compra guardada" con el mensaje del servidor', async () => {
    mockCondicion = { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' }
    await hastaRecepcion()
    await prender()
    fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
    expect(screen.getByText(/Vence el 04\/11\/2026/)).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalled(), ESPERA)
    expect(mockPostConSobre).toHaveBeenCalledTimes(1)
    expect(mockPostConSobre).toHaveBeenCalledWith(URL_CYR, { version: 10 + mockPut.mock.calls.length, fechaFacturaProveedor: '2026-10-05' })
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Compras/c1/confirmar', expect.anything())
    // En la URL solo la clave; el mensaje del servidor queda en memoria.
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/guardada?id=c1&aviso=recibida')
    expect(tomarAviso('c1', 'recibida')).toMatchObject({ texto: 'Compra confirmada. Compra recibida.', tono: 'exito' })
  })

  it('con la fecha de factura mal escrita lo dice y no deja confirmar y recibir', async () => {
    mockCondicion = { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' }
    await hastaRecepcion()
    await prender()
    fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '12/11')
    expect(screen.getByText('Escribí la fecha como dd/mm/aaaa.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar y recibir' })).toBeDisabled()
  })

  it('el comprobante cargado en el paso 4 se guarda después de recibir, con la misma API que el detalle', async () => {
    await hastaRecepcion()
    await prender()
    await userEvent.press(screen.getByRole('button', { name: 'Cargar los datos de la factura' }))
    expect(await screen.findByText('Comprobante del proveedor')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('CUIT del proveedor'), '20-12345678-6')
    fireEvent.changeText(screen.getByLabelText('Punto de venta'), '4')
    fireEvent.changeText(screen.getByLabelText('Número'), '12345')
    fireEvent.changeText(screen.getByLabelText('Neto gravado'), '1000')
    fireEvent.changeText(screen.getByLabelText('Total'), '1210')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar comprobante' }))
    expect(await screen.findByText('Factura A 00004-00012345')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/guardada?id=c1&aviso=recibida'), ESPERA)
    expect(mockPut).toHaveBeenCalledWith('/api/v1/Compras/c1/comprobante', expect.objectContaining({ letra: 'A', puntoVenta: 4, numero: 12345 }))
  })

  it('409 CompraYaRecibida no es un error: abre "Compra guardada" avisando que ya quedó recibida', async () => {
    mockPostConSobre.mockRejectedValue(Object.assign(new Error('La compra ya fue recibida.'), { status: 409, codigo: 'CompraYaRecibida', data: 'c1' }))
    await hastaRecepcion()
    await prender()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/guardada?id=c1&aviso=ya-recibida'), ESPERA)
    expect(tomarAviso('c1', 'ya-recibida')).toMatchObject({ texto: 'La compra ya quedó recibida.' })
  })

  it('sin condición conocida manda sin fecha; el 400 del servidor queda arriba y no sale de la pantalla', async () => {
    mockCondicion = undefined
    mockPostConSobre.mockRejectedValue(Object.assign(new Error('Falta la fecha de la factura del proveedor.'), { status: 400 }))
    await hastaRecepcion()
    await prender()
    expect(screen.queryByLabelText('Fecha de la factura')).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
    expect(await screen.findByText('Falta la fecha de la factura del proveedor.', {}, ESPERA)).toBeTruthy()
    expect(mockPostConSobre).toHaveBeenCalledWith(URL_CYR, expect.objectContaining({ fechaFacturaProveedor: null }))
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('otro 409: muestra el motivo, recarga la compra y la fecha escrita sigue para el reintento', async () => {
    mockCondicion = { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' }
    mockPostConSobre.mockRejectedValueOnce(Object.assign(new Error('Otro usuario modificó la compra.'), { status: 409 }))
    await hastaRecepcion()
    await prender()
    const base = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => base(url === '/api/v1/Compras/c1' ? '/api/v1/Compras/b9' : url))
    fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Compras/c1'), ESPERA)
    expect(await screen.findByText('Otro usuario modificó la compra.', {}, ESPERA)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
    expect((await screen.findByLabelText('Fecha de la factura', {}, ESPERA)).props.value).toBe('05/10/2026')
  })

  it('sin respuesta (red o timeout) no dice que no se hizo: abre la compra para revisarla', async () => {
    mockPostConSobre.mockRejectedValue(new TypeError('Network request failed'))
    await hastaRecepcion()
    await prender()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/c1?aviso=incierto'), ESPERA)
    expect(tomarAviso('c1', 'incierto')).toMatchObject({ texto: 'No sabemos si se recibió; revisá la compra.', tono: 'advertencia' })
  })
})

describe('depósito de la compra según permiso (S18)', () => {
  const conCaps = (caps: string[]) =>
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: caps.map((module) => ({ module, canRead: true })) } as never })
  const dosDepositos = () => {
    const prev = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => (url === '/api/v1/Depositos'
      ? Promise.resolve([{ id: DEPOSITO_CENTRAL_ID, nombre: 'Depósito Central', activo: true }, { id: 'dep-norte', nombre: 'Depósito Norte', activo: true }])
      : prev(url)))
  }

  it('sin CAP_VER_TODOS_LOS_DEPOSITOS el depósito se muestra y no se elige', async () => {
    conCaps([])
    dosDepositos()
    await hastaRecepcion()
    expect(await screen.findByText(/^Depósito: /, {}, ESPERA)).toBeTruthy()
    expect(screen.queryByLabelText('Depósito')).toBeNull()
  })

  it('con CAP_VER_TODOS_LOS_DEPOSITOS se elige entre los depósitos y va al borrador', async () => {
    conCaps(['CAP_VER_TODOS_LOS_DEPOSITOS'])
    dosDepositos()
    await hastaRecepcion()
    expect(await screen.findByLabelText('Depósito', {}, ESPERA)).toBeTruthy()
    await userEvent.press(screen.getByRole('radio', { name: 'Depósito Norte' }))
    await waitFor(() => expect(mockPut.mock.calls.at(-1)?.[1]).toMatchObject({ depositoId: 'dep-norte' }), ESPERA)
  })
})

describe('proveedor preseleccionado (desde la ficha del proveedor)', () => {
  it('con proveedorId crea el borrador de ese proveedor sin pasar por la lista', async () => {
    pantalla({ proveedorId: 'p1' })
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Compras/borradores', expect.objectContaining({ proveedorId: 'p1' })), ESPERA)
    expect(await screen.findByText('Paso 2 de 4', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText('Gorrión Mayorista')).toBeNull()
  })

  it('si al proveedor le faltan datos de compra, avisa y no crea el borrador', async () => {
    pantalla({ proveedorId: 'p2' })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/socios-comerciales/p2'), ESPERA)
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/Compras/borradores', expect.anything())
  })
})

describe('editar una compra guardada', () => {
  const GUARDADA = {
    id: 'c7', version: 7, proveedorId: 'p1', depositoId: DEPOSITO_CENTRAL_ID, gastosOperativos: 0, subtotalBrutoAmount: 4800, descuentoTotalAmount: 480, estado: 'Confirmado',
    detalles: [{ productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 100, descuentoPorcentaje: 10, moneda: 'USD' }],
  }
  beforeEach(() => {
    const prev = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => (url === '/api/v1/Compras/c7' ? Promise.resolve(GUARDADA) : prev(url)))
    mockPut.mockImplementation(() => Promise.resolve({ compraId: 'c7', version: 8, message: 'ok' }))
  })
  const cambiarCosto = async () => {
    await userEvent.press(await screen.findByRole('button', { name: 'Ver compra' }, ESPERA))
    await userEvent.press(screen.getByRole('button', { name: 'Cantidad y costo de Balde Nuvia 10L' }))
    await userEvent.clear(screen.getByLabelText('Costo por unidad ($)'))
    await userEvent.type(screen.getByLabelText('Costo por unidad ($)'), '5')
    await userEvent.press(screen.getByRole('button', { name: 'Listo, seguir cargando' }))
  }

  it('carga la compra sin pasos ni paso 4, no autoguarda y guarda los cambios con un solo PUT con la versión', async () => {
    pantalla({ editarId: 'c7' })
    expect(await screen.findByText('4 bultos × 12 = 48 u', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText(/Paso \d de 4/)).toBeNull()
    await cambiarCosto()
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
    await new Promise((r) => setTimeout(r, 1200))
    expect(mockPut).not.toHaveBeenCalled()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockBack).toHaveBeenCalled(), ESPERA)
    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut.mock.calls[0][1]).toMatchObject({ version: 7, descuentoPorcentaje: 10, detalles: [{ unidadCompra: 'Bulto', monedaCosto: 'USD', costoUnitario: 5 }] })
  })

  it('dos toques seguidos en Guardar cambios mandan un solo PUT', async () => {
    pantalla({ editarId: 'c7' })
    await cambiarCosto()
    const boton = screen.getByRole('button', { name: 'Guardar cambios' })
    fireEvent.press(boton)
    fireEvent.press(boton)
    await waitFor(() => expect(mockBack).toHaveBeenCalled(), ESPERA)
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it('un error que no es 409 no ofrece el Reintentar del autoguardado: Guardar cambios reintenta y navega', async () => {
    mockPut.mockRejectedValueOnce(Object.assign(new Error('Sin conexión'), { status: 500 }))
    pantalla({ editarId: 'c7' })
    await cambiarCosto()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mockBack).toHaveBeenCalled(), ESPERA)
    expect(mockPut).toHaveBeenCalledTimes(2)
  })

  it('una compra cerrada abierta por enlace no se edita: aviso y vuelta al detalle', async () => {
    const prev = mockGet.getMockImplementation()!
    mockGet.mockImplementation((url: string) => (url === '/api/v1/Compras/c7' ? Promise.resolve({ ...GUARDADA, estado: 'Entregado' }) : prev(url)))
    pantalla({ editarId: 'c7' })
    expect(await screen.findByText('No se puede editar.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Volver al detalle' }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/compras/c7')
  })

  it('el 409 de estado final al guardar muestra su mensaje, sin Recargar', async () => {
    mockPut.mockRejectedValueOnce(Object.assign(new Error('No se puede editar una compra en estado Entregado.'), { status: 409 }))
    pantalla({ editarId: 'c7' })
    await cambiarCosto()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/No se puede editar una compra en estado Entregado/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recargar' })).toBeNull()
  })

  it('un 409 muestra el mensaje del servidor y ofrece recargar', async () => {
    mockPut.mockRejectedValueOnce(Object.assign(new Error('La compra ha sido modificada por otro usuario.'), { status: 409 }))
    pantalla({ editarId: 'c7' })
    await cambiarCosto()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/La compra ha sido modificada por otro usuario\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })
})

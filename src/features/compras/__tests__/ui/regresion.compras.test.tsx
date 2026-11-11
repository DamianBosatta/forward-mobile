import React from 'react'
import { fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompraNueva } from '@/features/compras/components/CompraNueva'
import { CompraDetalle } from '../../../../../app/(tabs)/compras/[id]'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'

jest.setTimeout(30000)
type Call = [string, string, unknown]
const mockLog: Call[] = []
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPut = jest.fn()
const mockPostConSobre = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (u: string, b: unknown) => { mockLog.push(['POST', u, b]); return mockPost(u, b) },
    put: (u: string, b: unknown) => { mockLog.push(['PUT', u, b]); return mockPut(u, b) },
    delete: jest.fn(),
    postConSobre: (u: string, b: unknown) => { mockLog.push(['POSTSOBRE', u, b]); return mockPostConSobre(u, b) },
  },
  API_URL: 'x',
}))
const mockReplace = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack }), useLocalSearchParams: () => ({}) }))
let mockPuedeModificar = true
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: (m: string, a: string) => m === 'MOD_COMPRAS' && (a === 'read' || (mockPuedeModificar && a === 'update')) }) }))
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }))
jest.mock('@/features/cuentas/components/FotoDelCobro', () => {
  const { Pressable, Text } = require('react-native')
  return { FotoDelCobro: ({ onUrl }: { onUrl: (u: string) => void }) => <Pressable accessibilityRole="button" accessibilityLabel="Foto de prueba" onPress={() => onUrl('https://cdn/x/factura.jpg')}><Text>foto</Text></Pressable> }
})
const mockDims = jest.fn(() => ({ width: 390, height: 800, scale: 2, fontScale: 1 }))
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const ESPERA = { timeout: 5000 }

let condicion: Record<string, { tipo: string; dias: number; descripcion: string } | undefined> = {}
const SOCIOS = [{ id: 'p1', razonSocial: 'Insumos del Sur SA', requiereCompletar: false }, { id: 'p3', razonSocial: 'Factura SRL', requiereCompletar: false }]
const CAT = [
  { id: 'pr1', nombre: 'Balde Nuvia 10L', bultoContenido: 12, ventaMinimaUnidades: 1, bultoMadreContenido: null },
  { id: 'pr2', nombre: 'Esponja Pack', bultoContenido: 1, ventaMinimaUnidades: 6, bultoMadreContenido: null },
]
const FICHAS: Record<string, unknown> = { pr1: { ...CAT[0], precioCompraBase: 1000 }, pr2: { ...CAT[1] } }
let depositos: unknown[] = []
const GUARDADA = {
  id: 'c7', version: 7, proveedorId: 'p1', depositoId: DEPOSITO_CENTRAL_ID, gastosOperativos: 0, subtotalBrutoAmount: 4800, descuentoTotalAmount: 480, estado: 'Confirmado',
  detalles: [{ productoId: 'pr1', nombreProducto: 'Balde Nuvia 10L', cantidad: 48, cantidadIngresada: 4, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 100, descuentoPorcentaje: 10, moneda: 'USD' }],
}
const lineaR = (id: string, nombre: string, cantidad: number, extra: Record<string, unknown> = {}) => ({
  id, productoId: `p-${id}`, nombreProducto: nombre, cantidad, cantidadIngresada: cantidad, unidadCompra: 'Unidad',
  costoUnitarioBaseAmount: 100, costoUnitarioNetoAmount: 100, descuentoPorcentaje: 0, subtotalAmount: cantidad * 100, ...extra,
})
const RECIBIR = {
  id: 'aaaa1111-0000', version: 3, numero: 1784, proveedorId: 'p1', razonSocialProveedor: 'Jofer Joan', depositoId: 'd', nombreDeposito: 'Depósito Central',
  fecha: '2026-10-17T15:00:00Z', estado: 'Confirmado', subtotalBrutoAmount: 7600, descuentoTotalAmount: 0, gastosOperativos: 0, totalAmount: 7600,
  condicionPago: { tipo: 'DiasDesdeFactura', descripcion: '30 días desde la factura' }, conFactura: false, eliminada: false,
  detalles: [lineaR('l1', 'Balde Nuvia 10L', 24, { cantidadIngresada: 2, unidadCompra: 'Bulto' }), lineaR('l2', 'Ocean Toalla Rollo', 40)],
}

beforeEach(() => {
  jest.clearAllMocks()
  mockLog.length = 0
  mockPuedeModificar = true
  condicion = { p1: { tipo: 'DiasDesdeEntrega', dias: 30, descripcion: '30 días' }, p3: { tipo: 'DiasDesdeFactura', dias: 30, descripcion: '30 días desde la factura' } }
  depositos = [{ id: DEPOSITO_CENTRAL_ID, nombre: 'Depósito Central', activo: true }]
  useAuthStore.setState({ user: null })
  mockPostConSobre.mockImplementation((u: string) => Promise.resolve(u.endsWith('recibir-parcial')
    ? { data: 'x', sobre: { succeeded: true, compraFaltanteId: 'f1', compraFaltanteNumero: 1785 } }
    : { data: 'c1', sobre: { succeeded: true, message: 'Compra confirmada. Compra recibida.' } }))
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/socios-comerciales?')) return Promise.resolve({ items: SOCIOS, totalCount: 2 })
    if (url.startsWith('/api/v1/socios-comerciales/')) { const id = url.split('/').pop()!; const s = SOCIOS.find((x) => x.id === id)!; return Promise.resolve({ ...s, cuit: '30-12345678-9', condicionPago: condicion[id], condicionesDeCompraFaltantes: [] }) }
    if (url.startsWith('/api/v1/Productos/catalogo-stock?')) return Promise.resolve({ items: CAT, page: 1, totalCount: 2, hasNextPage: false })
    if (url.startsWith('/api/v1/Productos/')) return Promise.resolve(FICHAS[url.split('/').pop()!])
    if (url === '/api/v1/Depositos') return Promise.resolve(depositos)
    if (url.startsWith('/api/v1/Compras?')) return Promise.resolve({ items: [], totalCount: 0, page: 1, hasNextPage: false })
    if (url === '/api/v1/Compras/c7') return Promise.resolve(GUARDADA)
    if (url === '/api/v1/Compras/aaaa1111-0000') return Promise.resolve(RECIBIR)
    if (url === '/api/v1/Compras/c1') return Promise.resolve({ ...RECIBIR, id: 'c1', estado: 'Entregado' })
    return Promise.reject(new Error(`GET inesperado ${url}`))
  })
  mockPost.mockImplementation((url: string) => (url === '/api/v1/Compras/borradores' ? Promise.resolve({ compraId: 'c1', version: 10, message: 'ok' }) : Promise.resolve(undefined)))
  let v = 10
  mockPut.mockImplementation((u: string) => Promise.resolve(u.endsWith('/comprobante') || u.endsWith('/foto-factura') ? 'ok' : { compraId: 'c1', version: ++v, message: 'ok' }))
})

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const nueva = (props: Record<string, string> = {}) => render(<QueryClientProvider client={qc()}><CompraNueva {...props} /></QueryClientProvider>)
const detalle = () => render(<QueryClientProvider client={qc()}><CompraDetalle id="aaaa1111-0000" /></QueryClientProvider>)
const conCaps = (caps: string[]) => useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: caps.map((module) => ({ module, canRead: true })) } as never })

/**
 * Regresión de la verificación de "Compras como venta": lo que la compra nueva, la edición y la recepción le mandan al
 * servidor no cambia respecto de antes (solo la navegación nueva a "Compra guardada"), y la edición deja cambiar el depósito.
 */
/** Normalized summary: last draft PUT body (without version), the other mutating calls, and whether CYR used the last PUT's version. */
function resumen() {
  const draftPuts = mockLog.filter(([m, u]) => m === 'PUT' && /\/Compras\/c\d+$/.test(u))
  const ultimoPut = draftPuts.at(-1)
  const otros = mockLog.filter((c) => !draftPuts.includes(c)).map(([m, u, b]) => {
    if (u.endsWith('confirmar-y-recibir')) {
      const { version, ...rest } = b as { version: number }
      return [m, u, { ...rest, versionEsDelUltimoGuardado: version === 10 + draftPuts.length }]
    }
    return [m, u, b]
  })
  const put = ultimoPut ? { ...(ultimoPut[2] as Record<string, unknown>) } : null
  if (put && ultimoPut![1] !== '/api/v1/Compras/c7') delete put.version
  return { ultimoPut: put, otros, replace: mockReplace.mock.calls.map((c) => c[0]), back: mockBack.mock.calls.length }
}
const settle = () => new Promise((r) => setTimeout(r, 1500))

// ---- HEAD driver (feat/compras-como-venta UI) ----
async function elegir(nombre: string) {
  await userEvent.press(await screen.findByRole('radio', { name: nombre }, ESPERA))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar a productos' })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: 'Continuar a productos' }))
  await screen.findByText('Paso 2 de 4', {}, ESPERA)
}
async function agregar(nombre: string, cantidad: string) {
  await userEvent.press(await screen.findByRole('button', { name: `Agregar ${nombre}` }, ESPERA))
  if (cantidad !== '1') {
    await linea('', nombre, { cantidad })
  }
}
/** Cantidad y costo screen: level, quantity, cost. */
async function linea(_id: string, nombre: string, o: { unidad?: string; cantidad?: string; costo?: string }) {
  await settle()
  await userEvent.press(screen.getAllByRole('button', { name: `Cantidad y costo de ${nombre}` })[0])
  const hoja = await screen.findByLabelText('Cantidad y costo', {}, ESPERA)
  if (o.unidad) await userEvent.press(within(hoja).getByRole('radio', { name: o.unidad }))
  if (o.cantidad) fireEvent.changeText(within(hoja).getAllByLabelText(/^(Unidades|Bultos|Bultos madre)$/)[0], o.cantidad)
  if (o.costo !== undefined) fireEvent.changeText(within(hoja).getByLabelText('Costo por unidad ($)'), o.costo)
  await userEvent.press(within(hoja).getByRole('button', { name: 'Listo, seguir cargando' }))
}
const ver = () => userEvent.press(screen.getByRole('button', { name: 'Ver compra' }))
const gastos = (t: string) => fireEvent.changeText(screen.getByLabelText('Gastos operativos ($)'), t)
async function paso4() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('Paso 4 de 4', {}, ESPERA)
}
async function terminarCon(boton: 'Confirmar compra' | 'Guardar nota de pedido') {
  await paso4(); await settle()
  await waitFor(() => expect(screen.getByRole('button', { name: boton })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: boton }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalled(), ESPERA)
}
async function confirmarYRecibir(fecha?: string, antes?: () => Promise<void>) {
  await settle()
  await userEvent.press(screen.getByRole('switch', { name: 'Recibir ahora' }))
  if (fecha) fireEvent.changeText(await screen.findByLabelText('Fecha de la factura'), fecha)
  if (antes) await antes()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar y recibir' })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: 'Confirmar y recibir' }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalled(), ESPERA)
}

it('S1 bulto x3, cost 1150,50, gastos 1500 -> confirm', async () => {
  nueva(); await elegir('Insumos del Sur SA'); await agregar('Balde Nuvia 10L', '1')
  await linea('pr1', 'Balde Nuvia 10L', { cantidad: '3', costo: '1150,50' })
  await ver(); gastos('1.500'); await terminarCon('Confirmar compra')
  expect(resumen()).toEqual({
      "ultimoPut": {
        "id": "c1",
        "proveedorId": "p1",
        "depositoId": DEPOSITO_CENTRAL_ID,
        "gastosOperativos": 1500,
        "descuentoPorcentaje": 0,
        "detalles": [
          {
            "productoId": "pr1",
            "cantidad": 3,
            "costoUnitario": 1150.5,
            "monedaCosto": "ARS",
            "unidadCompra": "Bulto"
          }
        ]
      },
      "otros": [
        [
          "POST",
          "/api/v1/Compras/borradores",
          {
            "proveedorId": "p1",
            "depositoId": DEPOSITO_CENTRAL_ID
          }
        ],
        [
          "POST",
          "/api/v1/Compras/c1/confirmar",
          {
            "compraId": "c1"
          }
        ]
      ],
      "replace": [
        "/(tabs)/compras/guardada?id=c1"
      ],
      "back": 0
    })
})
it('S2 pack-of-6 unit product 12 u cost 100 -> order note', async () => {
  nueva(); await elegir('Insumos del Sur SA'); await agregar('Esponja Pack', '1')
  await linea('pr2', 'Esponja Pack', { cantidad: '12', costo: '100' })
  await ver(); await terminarCon('Guardar nota de pedido')
  expect(resumen()).toEqual({
      "ultimoPut": {
        "id": "c1",
        "proveedorId": "p1",
        "depositoId": DEPOSITO_CENTRAL_ID,
        "gastosOperativos": 0,
        "descuentoPorcentaje": 0,
        "detalles": [
          {
            "productoId": "pr2",
            "cantidad": 12,
            "costoUnitario": 100,
            "monedaCosto": "ARS",
            "unidadCompra": "Unidad"
          }
        ]
      },
      "otros": [
        [
          "POST",
          "/api/v1/Compras/borradores",
          {
            "proveedorId": "p1",
            "depositoId": DEPOSITO_CENTRAL_ID
          }
        ],
        [
          "POST",
          "/api/v1/Compras/c1/guardar-nota-pedido",
          {
            "compraId": "c1",
            "version": 12
          }
        ]
      ],
      "replace": [
        "/(tabs)/compras/guardada?id=c1"
      ],
      "back": 0
    })
})
it('S3 bulto product bought in units: 24 u at precargado cost', async () => {
  nueva(); await elegir('Insumos del Sur SA'); await agregar('Balde Nuvia 10L', '1')
  await linea('pr1', 'Balde Nuvia 10L', { unidad: 'Unidad', cantidad: '24' })
  await ver(); await terminarCon('Confirmar compra')
  expect(resumen()).toEqual({
      "ultimoPut": {
        "id": "c1",
        "proveedorId": "p1",
        "depositoId": DEPOSITO_CENTRAL_ID,
        "gastosOperativos": 0,
        "descuentoPorcentaje": 0,
        "detalles": [
          {
            "productoId": "pr1",
            "cantidad": 24,
            "costoUnitario": 1000,
            "monedaCosto": "ARS",
            "unidadCompra": "Unidad"
          }
        ]
      },
      "otros": [
        [
          "POST",
          "/api/v1/Compras/borradores",
          {
            "proveedorId": "p1",
            "depositoId": DEPOSITO_CENTRAL_ID
          }
        ],
        [
          "POST",
          "/api/v1/Compras/c1/confirmar",
          {
            "compraId": "c1"
          }
        ]
      ],
      "replace": [
        "/(tabs)/compras/guardada?id=c1"
      ],
      "back": 0
    })
})
it('S4 confirm-and-receive with invoice date, second depot', async () => {
  conCaps(['CAP_VER_TODOS_LOS_DEPOSITOS'])
  depositos = [{ id: DEPOSITO_CENTRAL_ID, nombre: 'Depósito Central', activo: true }, { id: 'dep-norte', nombre: 'Depósito Norte', activo: true }]
  nueva(); await elegir('Factura SRL'); await agregar('Balde Nuvia 10L', '2')
  await linea('pr1', 'Balde Nuvia 10L', { costo: '1000' })
  await ver(); await paso4()
  await userEvent.press(await screen.findByRole('radio', { name: 'Depósito Norte' }, ESPERA))
  await confirmarYRecibir('05/10/2026')
  expect(resumen()).toEqual({
      "ultimoPut": {
        "id": "c1",
        "proveedorId": "p3",
        "depositoId": "dep-norte",
        "gastosOperativos": 0,
        "descuentoPorcentaje": 0,
        "detalles": [
          {
            "productoId": "pr1",
            "cantidad": 2,
            "costoUnitario": 1000,
            "monedaCosto": "ARS",
            "unidadCompra": "Bulto"
          }
        ]
      },
      "otros": [
        [
          "POST",
          "/api/v1/Compras/borradores",
          {
            "proveedorId": "p3",
            "depositoId": DEPOSITO_CENTRAL_ID
          }
        ],
        [
          "POSTSOBRE",
          "/api/v1/Compras/c1/confirmar-y-recibir",
          {
            "fechaFacturaProveedor": "2026-10-05",
            "versionEsDelUltimoGuardado": true
          }
        ]
      ],
      "replace": [
        "/(tabs)/compras/guardada?id=c1&aviso=recibida"
      ],
      "back": 0
    })
})
it('S5 confirm-and-receive without invoice condition', async () => {
  nueva(); await elegir('Insumos del Sur SA'); await agregar('Balde Nuvia 10L', '1')
  await linea('pr1', 'Balde Nuvia 10L', { costo: '1000' })
  await ver(); await paso4(); await confirmarYRecibir()
  expect(resumen()).toEqual({
      "ultimoPut": {
        "id": "c1",
        "proveedorId": "p1",
        "depositoId": DEPOSITO_CENTRAL_ID,
        "gastosOperativos": 0,
        "descuentoPorcentaje": 0,
        "detalles": [
          {
            "productoId": "pr1",
            "cantidad": 1,
            "costoUnitario": 1000,
            "monedaCosto": "ARS",
            "unidadCompra": "Bulto"
          }
        ]
      },
      "otros": [
        [
          "POST",
          "/api/v1/Compras/borradores",
          {
            "proveedorId": "p1",
            "depositoId": DEPOSITO_CENTRAL_ID
          }
        ],
        [
          "POSTSOBRE",
          "/api/v1/Compras/c1/confirmar-y-recibir",
          {
            "fechaFacturaProveedor": null,
            "versionEsDelUltimoGuardado": true
          }
        ]
      ],
      "replace": [
        "/(tabs)/compras/guardada?id=c1&aviso=recibida"
      ],
      "back": 0
    })
})
it('S6 edit ?edit= : change cost, and the depot when allowed', async () => {
  conCaps(['CAP_VER_TODOS_LOS_DEPOSITOS'])
  depositos = [{ id: DEPOSITO_CENTRAL_ID, nombre: 'Depósito Central', activo: true }, { id: 'dep-norte', nombre: 'Depósito Norte', activo: true }]
  mockPut.mockImplementation(() => Promise.resolve({ compraId: 'c7', version: 8, message: 'ok' }))
  nueva({ editarId: 'c7' })
  await screen.findByRole('button', { name: 'Ver compra' }, ESPERA)
  await ver()
  await linea('pr1', 'Balde Nuvia 10L', { costo: '150' })
  const norte = screen.queryByRole('radio', { name: 'Depósito Norte' })
  // B1: en edición, quien ve todos los depósitos los puede cambiar (como en el paso 3 de antes).
  expect(norte).toBeTruthy()
  if (norte) await userEvent.press(norte)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(mockBack).toHaveBeenCalled(), ESPERA)
  expect(resumen()).toEqual({
      "ultimoPut": {
        "id": "c7",
        "proveedorId": "p1",
        "depositoId": "dep-norte",
        "gastosOperativos": 0,
        "descuentoPorcentaje": 10,
        "detalles": [
          {
            "productoId": "pr1",
            "cantidad": 4,
            "costoUnitario": 150,
            "monedaCosto": "USD",
            "unidadCompra": "Bulto"
          }
        ],
        "version": 7
      },
      "otros": [],
      "replace": [],
      "back": 1
    })
})

// ---- voucher after confirm-and-receive (head only) ----
async function cargarComprobante(conFoto: boolean) {
  await userEvent.press(screen.getByRole('button', { name: 'Cargar los datos de la factura' }))
  await screen.findByText('Comprobante del proveedor', {}, ESPERA)
  if (conFoto) await userEvent.press(screen.getByRole('button', { name: 'Foto de prueba' }))
  fireEvent.changeText(screen.getByLabelText('CUIT del proveedor'), '20-12345678-6')
  fireEvent.changeText(screen.getByLabelText('Razón social'), 'Jofer Joan')
  fireEvent.changeText(screen.getByLabelText('Punto de venta'), '4')
  fireEvent.changeText(screen.getByLabelText('Número'), '12345')
  fireEvent.changeText(screen.getByLabelText('Fecha del comprobante'), '05/10/2026')
  fireEvent.changeText(screen.getByLabelText('Neto gravado'), '1000')
  fireEvent.changeText(screen.getByLabelText('Total'), '1210')
  await userEvent.press(screen.getByRole('button', { name: 'Guardar comprobante' }))
  await screen.findByText('Factura A 00004-00012345', {}, ESPERA)
}
async function hastaPaso4() {
  nueva(); await elegir('Insumos del Sur SA'); await agregar('Balde Nuvia 10L', '1')
  await linea('pr1', 'Balde Nuvia 10L', { costo: '1000' })
  await ver(); await paso4()
}
const ESPERADO_V: Record<string, unknown> = {
  "V1": {
    "ultimoPut": {
      "id": "c1",
      "proveedorId": "p1",
      "depositoId": DEPOSITO_CENTRAL_ID,
      "gastosOperativos": 0,
      "descuentoPorcentaje": 0,
      "detalles": [
        {
          "productoId": "pr1",
          "cantidad": 1,
          "costoUnitario": 1000,
          "monedaCosto": "ARS",
          "unidadCompra": "Bulto"
        }
      ]
    },
    "otros": [
      [
        "POST",
        "/api/v1/Compras/borradores",
        {
          "proveedorId": "p1",
          "depositoId": DEPOSITO_CENTRAL_ID
        }
      ],
      [
        "POSTSOBRE",
        "/api/v1/Compras/c1/confirmar-y-recibir",
        {
          "fechaFacturaProveedor": null,
          "versionEsDelUltimoGuardado": true
        }
      ],
      [
        "PUT",
        "/api/v1/Compras/c1/comprobante",
        {
          "tipo": "Factura",
          "letra": "A",
          "puntoVenta": 4,
          "numero": 12345,
          "fecha": "2026-10-05",
          "cuitEmisor": "20123456786",
          "razonSocialEmisor": "Jofer Joan",
          "noGravado": 0,
          "exento": 0,
          "total": 1210,
          "alicuotas": [
            {
              "alicuota": "Veintiuno",
              "netoGravado": 1000,
              "iva": 210
            }
          ],
          "tributos": []
        }
      ],
      [
        "PUT",
        "/api/v1/Compras/c1/foto-factura",
        {
          "fotoUrl": "https://cdn/x/factura.jpg"
        }
      ]
    ],
    "replace": [
      "/(tabs)/compras/guardada?id=c1&aviso=recibida"
    ],
    "back": 0,
    "aviso": {
      "clave": "recibida",
      "texto": "Compra confirmada. Compra recibida.",
      "tono": "exito"
    }
  },
  "V2": {
    "ultimoPut": {
      "id": "c1",
      "proveedorId": "p1",
      "depositoId": DEPOSITO_CENTRAL_ID,
      "gastosOperativos": 0,
      "descuentoPorcentaje": 0,
      "detalles": [
        {
          "productoId": "pr1",
          "cantidad": 1,
          "costoUnitario": 1000,
          "monedaCosto": "ARS",
          "unidadCompra": "Bulto"
        }
      ]
    },
    "otros": [
      [
        "POST",
        "/api/v1/Compras/borradores",
        {
          "proveedorId": "p1",
          "depositoId": DEPOSITO_CENTRAL_ID
        }
      ],
      [
        "POSTSOBRE",
        "/api/v1/Compras/c1/confirmar-y-recibir",
        {
          "fechaFacturaProveedor": null,
          "versionEsDelUltimoGuardado": true
        }
      ],
      [
        "PUT",
        "/api/v1/Compras/c1/comprobante",
        {
          "tipo": "Factura",
          "letra": "A",
          "puntoVenta": 4,
          "numero": 12345,
          "fecha": "2026-10-05",
          "cuitEmisor": "20123456786",
          "razonSocialEmisor": "Jofer Joan",
          "noGravado": 0,
          "exento": 0,
          "total": 1210,
          "alicuotas": [
            {
              "alicuota": "Veintiuno",
              "netoGravado": 1000,
              "iva": 210
            }
          ],
          "tributos": []
        }
      ]
    ],
    "replace": [
      "/(tabs)/compras/guardada?id=c1&aviso=recibida"
    ],
    "back": 0,
    "aviso": {
      "clave": "recibida",
      "texto": "Compra confirmada. Compra recibida. No se guardó el comprobante: Error del servidor X. Cargalo desde acá.",
      "tono": "advertencia"
    }
  },
  "V3": {
    "ultimoPut": {
      "id": "c1",
      "proveedorId": "p1",
      "depositoId": DEPOSITO_CENTRAL_ID,
      "gastosOperativos": 0,
      "descuentoPorcentaje": 0,
      "detalles": [
        {
          "productoId": "pr1",
          "cantidad": 1,
          "costoUnitario": 1000,
          "monedaCosto": "ARS",
          "unidadCompra": "Bulto"
        }
      ]
    },
    "otros": [
      [
        "POST",
        "/api/v1/Compras/borradores",
        {
          "proveedorId": "p1",
          "depositoId": DEPOSITO_CENTRAL_ID
        }
      ],
      [
        "POSTSOBRE",
        "/api/v1/Compras/c1/confirmar-y-recibir",
        {
          "fechaFacturaProveedor": null,
          "versionEsDelUltimoGuardado": true
        }
      ],
      [
        "PUT",
        "/api/v1/Compras/c1/comprobante",
        {
          "tipo": "Factura",
          "letra": "A",
          "puntoVenta": 4,
          "numero": 12345,
          "fecha": "2026-10-05",
          "cuitEmisor": "20123456786",
          "razonSocialEmisor": "Jofer Joan",
          "noGravado": 0,
          "exento": 0,
          "total": 1210,
          "alicuotas": [
            {
              "alicuota": "Veintiuno",
              "netoGravado": 1000,
              "iva": 210
            }
          ],
          "tributos": []
        }
      ],
      [
        "PUT",
        "/api/v1/Compras/c1/foto-factura",
        {
          "fotoUrl": "https://cdn/x/factura.jpg"
        }
      ]
    ],
    "replace": [
      "/(tabs)/compras/guardada?id=c1&aviso=recibida"
    ],
    "back": 0,
    "aviso": {
      "clave": "recibida",
      "texto": "Compra confirmada. Compra recibida. El comprobante quedó guardado, pero no la foto de la factura: Error del servidor X. Cargala desde la compra.",
      "tono": "advertencia"
    }
  }
}
const { tomarAviso } = require('@/features/compras/lib/confirmar-y-recibir')
for (const [k, falla] of [['V1', null], ['V2', 'comprobante'], ['V3', 'foto']] as const) {
  it(`${k} voucher after CYR, failing: ${falla}`, async () => {
    if (falla) {
      const prev = mockPut.getMockImplementation()!
      mockPut.mockImplementation((u: string, b: unknown) => (u.endsWith(falla === 'foto' ? '/foto-factura' : '/comprobante')
        ? Promise.reject(Object.assign(new Error('Error del servidor X.'), { status: 500 })) : prev(u, b)))
    }
    await hastaPaso4()
    await confirmarYRecibir(undefined, async () => { await cargarComprobante(true) })
    expect({ ...resumen(), aviso: tomarAviso('c1', 'recibida') }).toEqual(ESPERADO_V[k])
  })
}
it('V4 CYR without answer (incierto) with voucher loaded', async () => {
  mockPostConSobre.mockRejectedValue(new Error('timeout'))
  await hastaPaso4()
  await confirmarYRecibir(undefined, async () => { await cargarComprobante(false) })
  expect({ ...resumen(), aviso: tomarAviso('c1', 'incierto') }).toEqual({
      "ultimoPut": {
        "id": "c1",
        "proveedorId": "p1",
        "depositoId": DEPOSITO_CENTRAL_ID,
        "gastosOperativos": 0,
        "descuentoPorcentaje": 0,
        "detalles": [
          {
            "productoId": "pr1",
            "cantidad": 1,
            "costoUnitario": 1000,
            "monedaCosto": "ARS",
            "unidadCompra": "Bulto"
          }
        ]
      },
      "otros": [
        [
          "POST",
          "/api/v1/Compras/borradores",
          {
            "proveedorId": "p1",
            "depositoId": DEPOSITO_CENTRAL_ID
          }
        ],
        [
          "POSTSOBRE",
          "/api/v1/Compras/c1/confirmar-y-recibir",
          {
            "fechaFacturaProveedor": null,
            "versionEsDelUltimoGuardado": true
          }
        ]
      ],
      "replace": [
        "/(tabs)/compras/c1?aviso=incierto"
      ],
      "back": 0,
      "aviso": {
        "clave": "incierto",
        "texto": "No sabemos si se recibió; revisá la compra.",
        "tono": "advertencia"
      }
    })
})

// ---- Recibir mercadería (detail) ----
async function abrirRecibir() {
  detalle()
  await userEvent.press(await screen.findByRole('button', { name: 'Recibir mercadería' }, ESPERA))
  await screen.findByLabelText('Llegó de Balde Nuvia 10L', {}, ESPERA)
}
async function comprobante() {
  await cargarComprobante(false)
}
async function recibir() {
  fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar recepción' })).toBeEnabled(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: 'Confirmar recepción' }))
  await waitFor(() => expect(mockLog.some(([, u]) => /recibir/.test(u))).toBe(true), ESPERA)
  await settle()
}
it('R1 full receive', async () => {
  await abrirRecibir(); await recibir()
  expect({ calls: [...mockLog] }).toEqual({
      "calls": [
        [
          "POST",
          "/api/v1/Compras/aaaa1111-0000/recibir",
          {
            "compraId": "aaaa1111-0000",
            "fechaFacturaProveedor": "2026-10-05"
          }
        ]
      ]
    })
})
it('R2 partial with shortfall', async () => {
  await abrirRecibir()
  fireEvent.changeText(screen.getByLabelText('Llegó de Ocean Toalla Rollo'), '30')
  await recibir()
  expect({ calls: [...mockLog], avisoFaltante: !!screen.queryByText(/1785/) }).toEqual({
      "calls": [
        [
          "POSTSOBRE",
          "/api/v1/Compras/aaaa1111-0000/recibir-parcial",
          {
            "fechaFacturaProveedor": "2026-10-05",
            "lineas": [
              {
                "detalleId": "l1",
                "cantidadRecibida": 24
              },
              {
                "detalleId": "l2",
                "cantidadRecibida": 30
              }
            ]
          }
        ]
      ],
      "avisoFaltante": true
    })
})
it('R3 full receive with voucher', async () => {
  await abrirRecibir(); await comprobante(); await recibir()
  expect({ calls: [...mockLog] }).toEqual({
      "calls": [
        [
          "POST",
          "/api/v1/Compras/aaaa1111-0000/recibir",
          {
            "compraId": "aaaa1111-0000",
            "fechaFacturaProveedor": "2026-10-05",
            "comprobante": {
              "tipo": "Factura",
              "letra": "A",
              "puntoVenta": 4,
              "numero": 12345,
              "fecha": "2026-10-05",
              "cuitEmisor": "20123456786",
              "razonSocialEmisor": "Jofer Joan",
              "noGravado": 0,
              "exento": 0,
              "total": 1210,
              "alicuotas": [
                {
                  "alicuota": "Veintiuno",
                  "netoGravado": 1000,
                  "iva": 210
                }
              ],
              "tributos": []
            }
          }
        ]
      ]
    })
})
it('R4 receiving more than ordered is blocked', async () => {
  await abrirRecibir()
  fireEvent.changeText(screen.getByLabelText('Llegó de Ocean Toalla Rollo'), '41')
  fireEvent.changeText(screen.getByLabelText('Fecha de la factura'), '05/10/2026')
  expect({ botonHabilitado: !screen.getByRole('button', { name: 'Confirmar recepción' }).props.accessibilityState?.disabled }).toEqual({
      "botonHabilitado": false
    })
})

/**
 * S16 (tanda mobile 2026-11-11): la pantalla Stock con la estructura de "Inventario & Stock" de la web, solo ver.
 * Maqueta aprobada: stock-propuesta (8 láminas). Pantalla real con react-query real; solo el transporte HTTP es falso.
 */
import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import StockScreen from '../../../../app/(tabs)/inventario/stock'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'

jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390 }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('expo-router/react-navigation', () => ({ DrawerActions: { openDrawer: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: jest.fn(), post: jest.fn() } }))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }
jest.setTimeout(20_000)

const base = { depositoId: DEPOSITO_CENTRAL_ID, deposito: 'Central', cantidadTransito: 0, activo: true, esPadreDeVariantes: false, puedeVenderse: true }
const FILA_MAKE = {
  ...base, id: 's1', productoId: 'p-make', producto: 'Make Lavajean', marca: 'Marca Ejemplo', codigoPropio: 'PRO06787',
  cantidadActual: 14, cantidadVirtual: 48, cantidadReservada: 6, cantidadDisponible: 8, stockMinimo: 24, enAlerta: true,
}
const FILA_LINEA = {
  ...base, id: 's2', productoId: 'p-linea', producto: 'Aromas 250 ml', marca: 'Marca Demo', codigoPropio: 'PD-0100', esPadreDeVariantes: true,
  cantidadActual: 226, cantidadVirtual: 0, cantidadReservada: 12, cantidadDisponible: 214, stockMinimo: 0, enAlerta: false,
}
const FILA_TOALLA = {
  ...base, id: 's3', productoId: 'p-toalla', producto: 'Ocean Toalla Rollo', codigoPropio: 'TR905',
  cantidadActual: 0, cantidadVirtual: 12, cantidadReservada: 0, cantidadDisponible: 0, stockMinimo: 10, enAlerta: true,
}

const RESUMEN = {
  totales: { filas: 3, articulos: 1703, sinStock: 34, enAlerta: 112, conStock: 1557, sinPeso: 5 },
  estados: [{ estado: 'SinStock', cantidad: 34 }, { estado: 'EnAlerta', cantidad: 112 }, { estado: 'ConStock', cantidad: 1557 }],
  depositos: [{ id: DEPOSITO_CENTRAL_ID, nombre: 'Central', cantidad: 1703 }, { id: 'dep-norte', nombre: 'Norte', cantidad: 400 }],
  lineas: [{ id: 'lin-1', nombre: 'Línea Ejemplo', cantidad: 96 }],
  marcas: [{ marca: 'marca demo', nombre: 'Marca Demo', cantidad: 88 }],
}

const VARIANTES = [
  { id: 'v-coco', nombre: 'Coco', codigoPropio: 'PD-0107', stockActual: 108, stockReservado: 12, stockDisponible: 96, precioVenta: 10, activo: true, puedeVenderse: true },
  { id: 'v-pino', nombre: 'Pino', codigoPropio: 'PD-0108', stockActual: 0, stockReservado: 0, stockDisponible: 0, precioVenta: 10, activo: false, puedeVenderse: false },
]

const PRODUCTO_MAKE = { id: 'p-make', nombre: 'Make Lavajean', codigoPropio: 'PRO06787', alicuotaIvaPorcentaje: 21, pesoKg: 1.05, cotUmbralPropioKg: null }

const MOVIMIENTOS = {
  page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasNextPage: false,
  items: [
    { id: 'm1', fecha: '2026-11-11T13:42:00Z', tipoMovimiento: 2, tipoLabel: 'Venta', cantidad: -6, direccion: 'Salida', usuarioNombre: 'Vendedor Ejemplo' },
    { id: 'm2', fecha: '2026-11-10T19:05:00Z', tipoMovimiento: 1, tipoLabel: 'Compra', cantidad: 48, direccion: 'Entrada', observacion: 'FC A 0001-00004567', usuarioNombre: 'Operario Ejemplo' },
  ],
}

const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })

let stocks: (url: string) => Promise<unknown>
let variantes: () => Promise<unknown>
let movimientos: () => Promise<unknown>
function servidor(url: string) {
  if (url.startsWith('/api/v1/Stocks/resumen')) return Promise.resolve(RESUMEN)
  if (url.startsWith('/api/v1/Stocks/movimientos')) return movimientos()
  if (url.startsWith('/api/v1/Stocks?')) return stocks(url)
  if (url.startsWith('/api/v1/Productos/p-linea/variantes')) return variantes()
  if (url.startsWith('/api/v1/Productos/p-make')) return Promise.resolve(PRODUCTO_MAKE)
  if (url.startsWith('/api/v1/Reportes/stock/valorizado')) return Promise.resolve({ diasInmovilizado: 30, total: { valorCosto: 18420500 } })
  if (url.startsWith('/api/v1/Productos/catalogo-stock?')) {
    return Promise.resolve(pagina([{ id: 'p-make', nombre: 'Make Lavajean', codigoPropio: 'PRO06787', precioMinimoRentable: 1000, precioAdecuado: 1200, precioPremium: 1500, costoRealPricing: 800 }]))
  }
  return Promise.reject(new Error(`sin respuesta para ${url}`))
}

const CANTIDADES = { module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }
const COSTOS = { module: 'CAP_VER_COSTOS', canRead: true }
function conUsuario(extra: { module: string; canRead: boolean }[] = []) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'u', roles: ['Vendedor'] as never, permissions: [{ module: 'MOD_STOCK', canRead: true }, CANTIDADES, ...extra] as never },
  })
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  render(<QueryClientProvider client={qc}><StockScreen /></QueryClientProvider>)
}

const urls = () => api.get.mock.calls.map(([u]) => u as string)
const ultimoStock = () => urls().filter((u) => u.startsWith('/api/v1/Stocks?')).pop() ?? ''
const ultimoResumen = () => urls().filter((u) => u.startsWith('/api/v1/Stocks/resumen')).pop() ?? ''
const abrir = async () => { await screen.findByText('Make Lavajean') }
const aLista = async () => { await userEvent.press(screen.getByRole('radio', { name: 'Lista' })) }

beforeEach(() => {
  api.get.mockReset().mockImplementation(servidor)
  api.post.mockReset().mockResolvedValue([])
  stocks = () => Promise.resolve(pagina([FILA_MAKE, FILA_LINEA, FILA_TOALLA]))
  variantes = () => Promise.resolve(VARIANTES)
  movimientos = () => Promise.resolve(MOVIMIENTOS)
  conUsuario()
})

describe('Tarjetas y Lista (láminas 1 y 4)', () => {
  it('abre en Tarjetas: cada tarjeta con el disponible grande y "disponible" o "En alerta"; totales Artículos y En alerta', async () => {
    pintar()
    await abrir()
    expect(screen.getByRole('radio', { name: 'Tarjetas', selected: true })).toBeTruthy()
    const make = screen.getByLabelText('Make Lavajean, disponible: 8, en alerta de stock')
    expect(within(make).getByText('8')).toBeTruthy()
    expect(within(make).getByText('En alerta')).toBeTruthy()
    const linea = screen.getByLabelText('Aromas 250 ml, total en stock: 214')
    expect(within(linea).getByText('en stock (línea)')).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('Artículos: 1703')).toBeTruthy())
    expect(screen.getByLabelText('En alerta: 112')).toBeTruthy()
    expect(screen.queryByLabelText('Con stock: 1557')).toBeNull()
    expect(screen.queryByLabelText('Sin stock: 34')).toBeNull()
  })

  it('Lista: cada renglón con disponible, stock real, mínimo, reservado y por entrar, y los cuatro totales', async () => {
    pintar()
    await abrir()
    await aLista()
    expect(screen.getByRole('radio', { name: 'Lista', selected: true })).toBeTruthy()
    expect(await screen.findByText('Stock real 14 · Mín. 24')).toBeTruthy()
    expect(screen.getByText('Reservado 6 · Por entrar 48')).toBeTruthy()
    expect(within(screen.getByLabelText('Ocean Toalla Rollo, TR905')).getByText('Sin stock')).toBeTruthy()
    expect(screen.getByLabelText('Artículos: 1703')).toBeTruthy()
    expect(screen.getByLabelText('Con stock: 1557')).toBeTruthy()
    expect(screen.getByLabelText('Sin stock: 34')).toBeTruthy()
    expect(screen.getByLabelText('En alerta: 112')).toBeTruthy()
    expect(screen.queryByText(/Virtual/)).toBeNull()
  })

  it('"Valor del stock a costo" solo en la Lista y solo con CAP_VER_COSTOS, del depósito elegido', async () => {
    conUsuario([COSTOS])
    pintar()
    await abrir()
    expect(screen.queryByText('Valor del stock a costo')).toBeNull()
    await aLista()
    expect(await screen.findByLabelText('Valor del stock a costo: $ 18.420.500')).toBeTruthy()
    const pedido = urls().find((u) => u.startsWith('/api/v1/Reportes/stock/valorizado'))!
    expect(pedido).toContain(`DepositoId=${DEPOSITO_CENTRAL_ID}`)
  })

  it('sin CAP_VER_COSTOS no hay valor a costo ni se pide el reporte', async () => {
    pintar()
    await abrir()
    await aLista()
    await screen.findByText('Stock real 14 · Mín. 24')
    expect(screen.queryByText('Valor del stock a costo')).toBeNull()
    expect(urls().some((u) => u.includes('/Reportes/stock/valorizado'))).toBe(false)
  })
})

describe('Filtros (lámina 3)', () => {
  const abrirFiltros = async () => { await userEvent.press(screen.getByRole('button', { name: 'Filtros' })) }

  it('la hoja muestra Estado de stock, Línea, Marca, "Solo sin peso" y "Solo ocultos" con lo que cuenta el servidor', async () => {
    pintar()
    await abrir()
    await waitFor(() => expect(screen.getByLabelText('Artículos: 1703')).toBeTruthy())
    await abrirFiltros()
    for (const t of ['Estado de stock', 'Línea', 'Marca']) expect(screen.getByText(t)).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Sin stock, 34' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'En alerta, 112' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Con stock, 1557' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Línea Ejemplo, 96' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Marca Demo, 88' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Solo sin peso, 5' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Solo ocultos' })).toBeTruthy()
  })

  it('cada filtro viaja al listado y al resumen; el botón cuenta los activos y "Limpiar" los saca', async () => {
    pintar()
    await abrir()
    await waitFor(() => expect(screen.getByLabelText('Artículos: 1703')).toBeTruthy())
    await abrirFiltros()
    await userEvent.press(screen.getByRole('checkbox', { name: 'En alerta, 112' }))
    await userEvent.press(screen.getByRole('checkbox', { name: 'Sin stock, 34' }))
    await userEvent.press(screen.getByRole('checkbox', { name: 'Línea Ejemplo, 96' }))
    await userEvent.press(screen.getByRole('checkbox', { name: 'Marca Demo, 88' }))
    await userEvent.press(screen.getByRole('checkbox', { name: 'Solo sin peso, 5' }))
    await userEvent.press(screen.getByRole('checkbox', { name: 'Solo ocultos' }))
    await waitFor(() => {
      const p = new URLSearchParams(ultimoStock().split('?')[1])
      expect(p.getAll('EstadoStock')).toEqual(['EnAlerta', 'SinStock'])
      expect(p.get('CategoriaId')).toBe('lin-1')
      expect(p.get('Marca')).toBe('marca demo')
      expect(p.get('SinPeso')).toBe('true')
      expect(p.get('Activo')).toBe('false')
    })
    const r = new URLSearchParams(ultimoResumen().split('?')[1])
    expect(r.getAll('EstadoStock')).toEqual(['EnAlerta', 'SinStock'])
    expect(r.get('CategoriaId')).toBe('lin-1')

    await userEvent.press(screen.getByRole('button', { name: 'Ver 1703 artículos' }))
    expect(screen.getByRole('button', { name: 'Filtros (6 activos)' })).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: 'Filtros (6 activos)' }))
    await userEvent.press(screen.getByRole('button', { name: 'Limpiar filtros' }))
    // Sin filtros vuelve la consulta de entrada (la sirve react-query de lo ya pedido): nada marcado, botón "Filtros".
    expect(screen.getByRole('checkbox', { name: 'En alerta, 112', checked: false })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Solo ocultos', checked: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeTruthy()
  })

  it('Línea y Marca son una sola: tocar la elegida la suelta', async () => {
    stocks = (url) => Promise.resolve(pagina(url.includes('CategoriaId=') ? [FILA_TOALLA] : [FILA_MAKE]))
    pintar()
    await abrir()
    await waitFor(() => expect(screen.getByLabelText('Artículos: 1703')).toBeTruthy())
    await abrirFiltros()
    await userEvent.press(screen.getByRole('checkbox', { name: 'Línea Ejemplo, 96' }))
    await waitFor(() => expect(ultimoStock()).toContain('CategoriaId=lin-1'))
    await screen.findByText('Ocean Toalla Rollo')
    await userEvent.press(screen.getByRole('checkbox', { name: 'Línea Ejemplo, 96' }))
    expect(screen.getByRole('checkbox', { name: 'Línea Ejemplo, 96', checked: false })).toBeTruthy()
    expect(await screen.findByText('Make Lavajean')).toBeTruthy()
    expect(screen.queryByText('Ocean Toalla Rollo')).toBeNull()
  })
})

describe('Línea con sus fragancias (lámina 2)', () => {
  it('"Ver fragancias" pide las variantes del depósito y muestra cada fragancia con su stock', async () => {
    pintar()
    await abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Ver fragancias' }))
    expect(await screen.findByText('Coco')).toBeTruthy()
    expect(screen.getByText('96 disponibles · 12 reservadas')).toBeTruthy()
    expect(screen.getByText('0 disponibles')).toBeTruthy()
    expect(screen.getByText('inactivo (no cuenta en la línea)')).toBeTruthy()
    expect(urls().some((u) => u === `/api/v1/Productos/p-linea/variantes?depositoId=${DEPOSITO_CENTRAL_ID}`)).toBe(true)
    await userEvent.press(screen.getByRole('button', { name: 'Ocultar fragancias' }))
    expect(screen.queryByText('Coco')).toBeNull()
  })

  it('si fallan o no hay: lo dice con los textos de la web', async () => {
    variantes = () => Promise.reject(new Error('boom'))
    pintar()
    await abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Ver fragancias' }))
    expect(await screen.findByText('No se pudieron cargar los aromas de esta línea.')).toBeTruthy()
  })

  it('sin fragancias generadas', async () => {
    variantes = () => Promise.resolve([])
    pintar()
    await abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Ver fragancias' }))
    expect(await screen.findByText('Esta línea todavía no tiene aromas generados.')).toBeTruthy()
  })
})

describe('Detalle del producto (lámina 5) y movimientos (lámina 6)', () => {
  const abrirDetalle = async () => { await userEvent.press(screen.getByLabelText('Make Lavajean, disponible: 8, en alerta de stock')) }

  it('muestra Stock Físico, Disponibilidad y Datos fiscales; sin costos, el aviso de gestión; nunca "Editar producto"', async () => {
    pintar()
    await abrir()
    await abrirDetalle()
    const hoja = screen.getByLabelText('Detalle de Make Lavajean')
    expect(within(hoja).getByText('Stock Físico')).toBeTruthy()
    expect(within(hoja).getByLabelText('Stock real: 14 unidades')).toBeTruthy()
    expect(within(hoja).getByLabelText('Disponible: 8')).toBeTruthy()
    expect(within(hoja).getByLabelText('Reservado: 6')).toBeTruthy()
    expect(within(hoja).getByLabelText('Por entrar: 48')).toBeTruthy()
    expect(await within(hoja).findByLabelText('Alícuota de IVA: 21 %')).toBeTruthy()
    expect(within(hoja).getByLabelText('Peso por unidad: 1,05 kg')).toBeTruthy()
    expect(within(hoja).getByLabelText('Umbral propio de COT: Régimen general')).toBeTruthy()
    expect(within(hoja).getByText('Información adicional disponible solo para roles de gestión.')).toBeTruthy()
    expect(within(hoja).queryByText('Rentabilidad')).toBeNull()
    expect(screen.queryByText(/Editar producto/)).toBeNull()
    expect(urls().some((u) => u.startsWith('/api/v1/Productos/catalogo-stock'))).toBe(false)
  })

  it('con CAP_VER_COSTOS suma Rentabilidad: bandas de precio y costo real', async () => {
    conUsuario([COSTOS])
    pintar()
    await abrir()
    await abrirDetalle()
    const hoja = screen.getByLabelText('Detalle de Make Lavajean')
    expect(within(hoja).getByText('Rentabilidad')).toBeTruthy()
    expect(await within(hoja).findByLabelText('Costo real: $ 800,00')).toBeTruthy()
    expect(within(hoja).getByLabelText('Mínimo rentable: $ 1.000,00')).toBeTruthy()
    expect(within(hoja).queryByText('Información adicional disponible solo para roles de gestión.')).toBeNull()
  })

  it('"Ver movimientos" lista tipo, fecha, cantidad con signo, observación y quién', async () => {
    pintar()
    await abrir()
    await abrirDetalle()
    await userEvent.press(screen.getByRole('button', { name: 'Ver movimientos' }))
    expect(await screen.findByText('Vendedor Ejemplo')).toBeTruthy()
    expect(screen.getByText('Venta')).toBeTruthy()
    expect(screen.getByText('11/11/2026 10:42')).toBeTruthy()
    expect(screen.getByText('-6')).toBeTruthy()
    expect(screen.getByText('+48')).toBeTruthy()
    expect(screen.getByText('FC A 0001-00004567')).toBeTruthy()
    const p = new URLSearchParams(urls().find((u) => u.startsWith('/api/v1/Stocks/movimientos'))!.split('?')[1])
    expect(p.get('ProductoId')).toBe('p-make')
  })

  it('sin movimientos y con error, los textos de la web', async () => {
    movimientos = () => Promise.resolve({ ...MOVIMIENTOS, items: [], totalCount: 0 })
    pintar()
    await abrir()
    await abrirDetalle()
    await userEvent.press(screen.getByRole('button', { name: 'Ver movimientos' }))
    expect(await screen.findByText('No hay movimientos registrados para este producto.')).toBeTruthy()
  })

  it('movimientos con error', async () => {
    movimientos = () => Promise.reject(new Error('boom'))
    pintar()
    await abrir()
    await abrirDetalle()
    await userEvent.press(screen.getByRole('button', { name: 'Ver movimientos' }))
    expect(await screen.findByText('No se pudo cargar el historial. Intentá de nuevo.')).toBeTruthy()
  })

  it('tocar una fragancia abre el mismo detalle', async () => {
    pintar()
    await abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Ver fragancias' }))
    await userEvent.press(await screen.findByLabelText('Coco, 96 disponibles · 12 reservadas'))
    expect(screen.getByLabelText('Detalle de Coco')).toBeTruthy()
    expect(within(screen.getByLabelText('Detalle de Coco')).getByLabelText('Stock real: 108 unidades')).toBeTruthy()
  })
})

describe('Estados (lámina 8)', () => {
  it('cargando: esqueletos de tarjeta', async () => {
    stocks = () => new Promise(() => {})
    pintar()
    expect(await screen.findAllByTestId('esqueleto-tarjeta')).toHaveLength(4)
  })

  it('vacío con solo "En alerta": el inventario está saludable', async () => {
    stocks = (url) => Promise.resolve(pagina(url.includes('EstadoStock=EnAlerta') ? [] : [FILA_MAKE]))
    pintar()
    await abrir()
    await waitFor(() => expect(screen.getByLabelText('Artículos: 1703')).toBeTruthy())
    await userEvent.press(screen.getByRole('button', { name: 'Filtros' }))
    await userEvent.press(screen.getByRole('checkbox', { name: 'En alerta, 112' }))
    await userEvent.press(screen.getByRole('button', { name: 'Ver 1703 artículos' }))
    expect(await screen.findByRole('header', { name: 'No hay artículos en alerta. ¡El inventario está saludable!' })).toBeTruthy()
  })

  it('vacío con otros filtros', async () => {
    stocks = () => Promise.resolve(pagina([]))
    pintar()
    expect(await screen.findByRole('header', { name: 'No hay artículos que coincidan con los filtros.' })).toBeTruthy()
  })
})

describe('Solo ver: ninguna acción cambia datos', () => {
  it('ni en Tarjetas, ni en Lista, ni en el detalle hay ajustar, transferir, pedir, editar, duplicar, activar ni seleccionar', async () => {
    const PROHIBIDO = /ajust|transfer|pedir|editar|duplicar|activar|desactivar|seleccion/i
    pintar()
    await abrir()
    expect(screen.queryByText(PROHIBIDO)).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    await aLista()
    await screen.findByText('Stock real 14 · Mín. 24')
    expect(screen.queryByText(PROHIBIDO)).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    await userEvent.press(screen.getByLabelText('Make Lavajean, PRO06787'))
    expect(screen.getByLabelText('Detalle de Make Lavajean')).toBeTruthy()
    expect(screen.queryByText(PROHIBIDO)).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
  })
})

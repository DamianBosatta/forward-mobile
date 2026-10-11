import React from 'react'
import { Linking } from 'react-native'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoConsultaScreen from '../../../../app/(tabs)/inventario/index'
import { useAuthStore } from '@/features/auth/store/auth.store'

// PR 1.2 — escáner. La cámara está simulada: un botón que "lee" mockCodigos, uno tras otro
// en el mismo instante (como la cámara real, que dispara varias lecturas por segundo).

let mockPermiso: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true }
let mockCodigos: string[] = []
const mockPedirPermiso = jest.fn()
jest.mock('expo-camera', () => {
  const { Pressable } = require('react-native')
  return {
    useCameraPermissions: () => [mockPermiso, mockPedirPermiso],
    CameraView: ({ onBarcodeScanned }: { onBarcodeScanned: (r: { data: string }) => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="Cámara simulada" onPress={() => mockCodigos.forEach((data) => onBarcodeScanned({ data }))} />
    ),
  }
})
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390 }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: jest.fn(), post: jest.fn() },
}))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }

const prod = (id: string, nombre: string, codigoPropio: string) => ({ id, nombre, codigoPropio, precioVenta: 1000, esPadreDeVariantes: false, activo: true })
const UNICO = prod('p-1', 'Saphirus Aerosol 250 ml', 'SAP-AER-250')
const OTRO = prod('p-2', 'Saphirus Aerosol 250 ml Coco', 'SAP-AER-251')
const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })

// Catálogo de venta (catalogo-stock): un producto suelto y una línea con dos fragancias.
const item = (id: string, codigoBarra: string | null, extra: object = {}) => ({ id, nombre: id, codigoBarra, esPadreDeVariantes: false, ...extra })
const SUELTO = item(UNICO.id, '7798114820536')
const LINEA = item('l-1', null, { esPadreDeVariantes: true })
const FAMILIA = [LINEA, item('f-1', '7790000000017', { productoPadreId: 'l-1' }), item('f-2', '7790000000024', { productoPadreId: 'l-1' })]
// Otro EAN que contiene al escaneado: no es el producto que se escaneó.
const PARECIDO = item(OTRO.id, '77981148205360')
const CATALOGO = [PARECIDO, ...FAMILIA, SUELTO]
/** Servidor que filtra por CodigoBarra (devuelve la familia del código), o viejo (lo ignora y devuelve todo). */
let mockFiltraCodigo = true

function servidor(url: string) {
  const codigo = /CodigoBarra=(\d+)/.exec(url)?.[1]
  if (codigo) {
    const familia = (p: { id: string; productoPadreId?: string }) => p.productoPadreId ?? p.id
    const leido = CATALOGO.find((p) => p.codigoBarra === codigo)
    return Promise.resolve(pagina(!mockFiltraCodigo ? CATALOGO : leido ? CATALOGO.filter((p) => familia(p) === familia(leido)) : []))
  }
  if (url.startsWith('/api/v1/Productos?')) return Promise.resolve(pagina([UNICO, OTRO]))
  if (url === `/api/v1/Productos/${UNICO.id}`) return Promise.resolve({ ...UNICO, ventaMinimaUnidades: 1, puedeVenderse: true })
  if (url === `/api/v1/Productos/${LINEA.id}`) return Promise.resolve({ ...LINEA, precioVenta: 1000, ventaMinimaUnidades: 1, activo: true })
  if (url === `/api/v1/Productos/${LINEA.id}/variantes`) return Promise.resolve([])
  return Promise.reject(new Error(`sin respuesta para ${url}`))
}
const pidio = (texto: string) => api.get.mock.calls.some(([u]) => String(u).includes(texto))

function renderPantalla() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={client}>
      <CatalogoConsultaScreen />
    </QueryClientProvider>,
  )
}

async function escanear(...codigos: string[]) {
  mockCodigos = codigos
  await userEvent.press(screen.getByRole('button', { name: 'Escanear código de barras' }))
  await userEvent.press(screen.getByRole('button', { name: 'Cámara simulada' }))
}

beforeEach(() => {
  mockFiltraCodigo = true
  mockPermiso = { granted: true, canAskAgain: true }
  mockPedirPermiso.mockReset()
  api.get.mockReset().mockImplementation(servidor)
  api.post.mockReset().mockResolvedValue([])
  useAuthStore.setState({
    user: { id: 'u1', username: 'u', roles: ['Vendedor'] as never, permissions: [{ module: 'MOD_STOCK', canRead: true }] as never },
  })
})

describe('Escáner del catálogo', () => {
  it('un producto suelto: busca el código exacto en el catálogo de venta y abre su ficha', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('7798114820536')

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(pidio('/api/v1/Productos/catalogo-stock?CodigoBarra=7798114820536&')).toBe(true)
    expect(api.get).toHaveBeenCalledWith(`/api/v1/Productos/${UNICO.id}`)
  })

  it('el código de una fragancia abre la ficha de su línea', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('7790000000024')

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith(`/api/v1/Productos/${LINEA.id}`)
    expect(pidio('/api/v1/Productos/f-2')).toBe(false)
  })

  it('servidor viejo (ignora CodigoBarra y devuelve todo): abre el producto que tiene ese código exacto', async () => {
    mockFiltraCodigo = false
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('7798114820536')

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith(`/api/v1/Productos/${UNICO.id}`)
    expect(pidio(`/api/v1/Productos/${OTRO.id}`)).toBe(false)
  })

  it('un código que no está: avisa y no abre ninguna ficha', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('779811')

    expect(await screen.findByText('No hay ningún producto con el código 779811.')).toBeTruthy()
    expect(screen.queryByText('Precio de lista por unidad')).toBeNull()
    expect(pidio('/api/v1/Productos/p-')).toBe(false)
    // Al tipear otra búsqueda, el aviso se va.
    await userEvent.type(screen.getByLabelText('Buscar por código o nombre'), 'a')
    expect(screen.queryByText('No hay ningún producto con el código 779811.')).toBeNull()
  })

  it('si no se puede buscar el código, lo dice', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    api.get.mockRejectedValue(new Error('sin red'))
    await escanear('7798114820536')

    expect(await screen.findByText('No se pudo buscar el código 7798114820536. Revisá la conexión y volvé a intentar.')).toBeTruthy()
  })

  it('si la cámara lee varias veces seguidas, vale solo la primera lectura', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('7798114820536', '7790000000024')

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(pidio('CodigoBarra=7790000000024')).toBe(false)
  })

  it('sin permiso todavía, explica para qué es la cámara y lo pide', async () => {
    mockPermiso = { granted: false, canAskAgain: true }
    renderPantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Escanear código de barras' }))

    expect(screen.getByText('Falta el permiso de la cámara')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Permitir la cámara' }))
    expect(mockPedirPermiso).toHaveBeenCalled()
  })

  it('con el permiso negado, dice cómo habilitarlo y ofrece la configuración', async () => {
    mockPermiso = { granted: false, canAskAgain: false }
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    renderPantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Escanear código de barras' }))

    expect(screen.getByText('La cámara está bloqueada para Forward')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cámara simulada' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Abrir la configuración' }))
    expect(abrir).toHaveBeenCalled()
  })
})

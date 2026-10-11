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

function servidor(url: string) {
  if (url.includes('searchTerm=7798114820536&')) return Promise.resolve(pagina([UNICO]))
  if (url.includes('searchTerm=779811&')) return Promise.resolve(pagina([UNICO, OTRO]))
  if (url.startsWith('/api/v1/Productos?')) return Promise.resolve(pagina([UNICO, OTRO]))
  if (url === `/api/v1/Productos/${UNICO.id}`) return Promise.resolve({ ...UNICO, ventaMinimaUnidades: 1, puedeVenderse: true })
  return Promise.reject(new Error(`sin respuesta para ${url}`))
}

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
  mockPermiso = { granted: true, canAskAgain: true }
  mockPedirPermiso.mockReset()
  api.get.mockReset().mockImplementation(servidor)
  api.post.mockReset().mockResolvedValue([])
  useAuthStore.setState({
    user: { id: 'u1', username: 'u', depositoId: 'dep-1', roles: ['Vendedor'] as never, permissions: [{ module: 'MOD_STOCK', canRead: true }] as never },
  })
})

describe('Escáner del catálogo', () => {
  it('un código con un único resultado busca en el servidor y abre la ficha', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('7798114820536')

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(api.get.mock.calls.some(([u]) => String(u).includes('searchTerm=7798114820536&'))).toBe(true)
    expect(api.get).toHaveBeenCalledWith(`/api/v1/Productos/${UNICO.id}`)
  })

  it('un código con varios resultados deja la búsqueda cargada y no abre ninguna ficha', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('779811')

    await waitFor(() => expect(api.get.mock.calls.some(([u]) => String(u).includes('searchTerm=779811&'))).toBe(true))
    expect(screen.getByLabelText('Buscar por código o nombre').props.value).toBe('779811')
    await screen.findByText('MOSTRANDO 2 DE 2')
    expect(screen.queryByText('Precio de lista por unidad')).toBeNull()
    expect(api.get.mock.calls.some(([u]) => String(u).startsWith('/api/v1/Productos/p-'))).toBe(false)
  })

  it('si la cámara lee varias veces seguidas, vale solo la primera lectura', async () => {
    renderPantalla()
    await screen.findByText(OTRO.nombre)
    await escanear('7798114820536', '779811')

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(api.get.mock.calls.some(([u]) => String(u).includes('searchTerm=779811&'))).toBe(false)
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

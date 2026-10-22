import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoConsultaScreen from '../../../../app/(tabs)/inventario/index'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'

// Vista Stock (láminas ModStock y TabStock): solo ver. Pantalla real con react-query real; solo el transporte HTTP es falso.

let mockAncho = 390
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: mockAncho }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: jest.fn(), post: jest.fn() },
}))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }

const NORTE_ID = 'dep-norte'

const FILA_MAKE = {
  id: 's1', productoId: 'p-make', producto: 'Make Lavajean', codigoPropio: 'PRO06787', depositoId: DEPOSITO_CENTRAL_ID, deposito: 'Central',
  cantidadActual: 14, cantidadVirtual: 48, cantidadTransito: 0, cantidadReservada: 6, cantidadDisponible: 8, stockMinimo: 24, enAlerta: true,
}
const FILA_TOALLA = {
  id: 's2', productoId: 'p-toalla', producto: 'Ocean Toalla Rollo', codigoPropio: 'TR905', depositoId: DEPOSITO_CENTRAL_ID, deposito: 'Central',
  cantidadActual: 19, cantidadVirtual: 0, cantidadTransito: 0, cantidadReservada: 0, cantidadDisponible: 0, stockMinimo: 30, enAlerta: true,
}

const RESUMEN = {
  totales: { filas: 2, articulos: 1703, sinStock: 34, enAlerta: 112, conStock: 1557, sinPeso: 0 },
  depositos: [
    { id: DEPOSITO_CENTRAL_ID, nombre: 'Central', cantidad: 1703 },
    { id: NORTE_ID, nombre: 'Norte', cantidad: 400 },
  ],
  lineas: [],
  marcas: [],
}

const PRODUCTO = { id: 'p-aer', nombre: 'Saphirus Aerosol 250 ml', codigoPropio: 'SAP-AER-250', precioVenta: 3077.85, esPadreDeVariantes: false, activo: true }

function servidor(url: string) {
  if (url.startsWith('/api/v1/Stocks/resumen')) return Promise.resolve(RESUMEN)
  if (url.startsWith('/api/v1/Stocks?')) {
    return Promise.resolve({ items: [FILA_MAKE, FILA_TOALLA], page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasNextPage: false })
  }
  if (url.startsWith('/api/v1/Productos?')) {
    return Promise.resolve({ items: [PRODUCTO], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNextPage: false })
  }
  return Promise.reject(new Error(`sin respuesta para ${url}`))
}

function conUsuario(permissions: { module: string; canRead: boolean }[] = [], depositoId?: string) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      username: 'u',
      roles: ['Vendedor'] as never,
      depositoId,
      permissions: [{ module: 'MOD_STOCK', canRead: true }, ...permissions] as never,
    },
  })
}

function renderPantalla() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={client}>
      <CatalogoConsultaScreen />
    </QueryClientProvider>,
  )
}

const llamadasGet = () => api.get.mock.calls.map(([url]) => url as string)
const abrirStock = async () => userEvent.press(await screen.findByRole('radio', { name: 'Stock' }))
const CON_CANTIDADES = [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }]

beforeEach(() => {
  mockAncho = 390
  api.get.mockReset().mockImplementation(servidor)
  api.post.mockReset().mockResolvedValue([{ productoId: PRODUCTO.id, disponible: false }])
  conUsuario()
})

describe('Stock por depósito, con CAP_VER_CANTIDADES_STOCK', () => {
  beforeEach(() => conUsuario(CON_CANTIDADES))

  it('muestra disponible, mínimo, reservadas y por ingresar de cada renglón, y los totales que cuenta el servidor', async () => {
    renderPantalla()
    await abrirStock()

    expect(await screen.findByText('Make Lavajean')).toBeTruthy()
    expect(screen.getByText('PRO06787 · mínimo 24')).toBeTruthy()
    expect(screen.getByText('6 reservadas · +48 por ingresar')).toBeTruthy()
    expect(screen.getByLabelText('Disponible 8')).toBeTruthy()
    expect(screen.getByText('Poco stock')).toBeTruthy()
    // Sin disponible: "Sin stock", y sin reservas ni por ingresar.
    expect(screen.getByText('sin reservas')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('1703')).toBeTruthy())
    expect(screen.getByText('112')).toBeTruthy()
    expect(screen.getByText('34')).toBeTruthy()
  })

  it('pide el stock del depósito del usuario y, si no tiene, el Central', async () => {
    renderPantalla()
    await abrirStock()
    await screen.findByText('Make Lavajean')
    expect(llamadasGet().find((u) => u.startsWith('/api/v1/Stocks?'))).toContain(`DepositoId=${DEPOSITO_CENTRAL_ID}`)

    conUsuario(CON_CANTIDADES, 'dep-1')
    api.get.mockClear()
    renderPantalla()
    await abrirStock()
    await waitFor(() => expect(llamadasGet().some((u) => u.startsWith('/api/v1/Stocks?') && u.includes('DepositoId=dep-1'))).toBe(true))
  })

  it('cambiar de depósito pide el stock de ese depósito', async () => {
    renderPantalla()
    await abrirStock()
    await userEvent.press(await screen.findByRole('button', { name: 'Norte' }))

    await waitFor(() => expect(llamadasGet().some((u) => u.startsWith('/api/v1/Stocks?') && u.includes(`DepositoId=${NORTE_ID}`))).toBe(true))
    expect(screen.getByRole('button', { name: 'Norte', selected: true })).toBeTruthy()
  })

  it('"En alerta" pide solo los renglones en alerta', async () => {
    renderPantalla()
    await abrirStock()
    await userEvent.press(await screen.findByRole('button', { name: 'En alerta' }))

    await waitFor(() => expect(llamadasGet().some((u) => u.startsWith('/api/v1/Stocks?') && u.includes('EstadoStock=EnAlerta'))).toBe(true))
  })

  it('no ofrece ninguna acción de ajuste: es solo consulta', async () => {
    renderPantalla()
    await abrirStock()
    await screen.findByText('Make Lavajean')
    expect(screen.queryByText(/ajust/i)).toBeNull()
    expect(api.post).not.toHaveBeenCalledWith(expect.stringContaining('/Stocks/adjust'), expect.anything())
  })

  it('en tablet (600 px o más) se ve como tabla con Disponible, Reservado, Por ingresar y Mínimo', async () => {
    mockAncho = 700
    renderPantalla()
    await abrirStock()

    await screen.findByText('Make Lavajean')
    for (const columna of ['Producto', 'Disponible', 'Reservado', 'Por ingresar', 'Mínimo']) {
      expect(screen.getByText(columna)).toBeTruthy()
    }
  })
})

describe('Stock por depósito, sin CAP_VER_CANTIDADES_STOCK', () => {
  it('muestra solo "Hay stock / Sin stock" y no pide ni dibuja cantidades', async () => {
    renderPantalla()
    await abrirStock()

    expect(await screen.findByText(PRODUCTO.nombre)).toBeTruthy()
    expect(await screen.findByText('Sin stock')).toBeTruthy()
    expect(screen.getByText('Tu perfil no ve cantidades: se muestra solo si hay o no hay stock.')).toBeTruthy()
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/Stocks'))).toBe(false)
    expect(screen.queryByText('Reservado')).toBeNull()
    expect(screen.queryByText('Artículos')).toBeNull()
  })
})

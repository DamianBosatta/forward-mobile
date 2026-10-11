import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoConsultaScreen from '../../../../app/(tabs)/inventario/index'
import { useAuthStore } from '@/features/auth/store/auth.store'

// PR 1.1 — catálogo de consulta. Se renderiza la pantalla real con react-query real;
// solo se reemplaza el transporte HTTP (api.get / api.post) por respuestas del servidor.

let mockAncho = 390
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: mockAncho }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: jest.fn(), post: jest.fn() },
}))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }

const AER = { id: 'p-aer', nombre: 'Saphirus Aerosol 250 ml', codigoPropio: 'SAP-AER-250', precioVenta: 3077.85, esPadreDeVariantes: false, activo: true }
const TEX = { id: 'p-tex', nombre: 'Saphirus Textil 250 ml', codigoPropio: 'SAP-TEX-250', precioVenta: 3980, esPadreDeVariantes: false, activo: true }

// Lo que manda el servidor A QUIEN TIENE la capacidad. Sin ella los manda null; acá se
// mandan igual para probar que la pantalla tampoco los dibuja sin la capacidad.
const DETALLE = {
  ...AER,
  precioMinimoRentable: 2585.39,
  precioCompraBase: 1846.71,
  margenBrutoPorcentaje: 40,
  ventaMinimaUnidades: 12,
  puedeVenderse: true,
  codigoBarra: '7798114820536',
  marca: 'Saphirus',
}

function servidor(url: string) {
  if (url.startsWith('/api/v1/Productos?')) {
    return Promise.resolve({ items: [AER, TEX], page: 1, pageSize: 20, totalCount: 57, totalPages: 3, hasNextPage: true })
  }
  if (url === `/api/v1/Productos/${AER.id}`) return Promise.resolve(DETALLE)
  if (url.startsWith('/api/v1/Stocks?')) {
    return Promise.resolve({
      items: [{ id: 's1', deposito: 'Central', cantidadActual: 184, cantidadReservada: 36, cantidadDisponible: 148 }],
    })
  }
  return Promise.reject(new Error(`sin respuesta para ${url}`))
}

function conUsuario(roles: string[], permissions: { module: string; canRead: boolean }[] = []) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      username: 'u',
      depositoId: 'dep-1',
      roles: roles as never,
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

beforeEach(() => {
  mockAncho = 390
  api.get.mockReset().mockImplementation(servidor)
  api.post.mockReset().mockResolvedValue([
    { productoId: AER.id, disponible: true },
    { productoId: TEX.id, disponible: false },
  ])
  conUsuario(['Vendedor'])
})

describe('Catálogo de consulta', () => {
  it('busca en el servidor con el término, esperando a que se deje de tipear', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)

    await userEvent.type(screen.getByLabelText('Buscar por código o nombre'), 'sap')
    // Recién tipeado: todavía no salió ninguna búsqueda.
    expect(llamadasGet().some((u) => u.includes('searchTerm='))).toBe(false)

    await waitFor(() => expect(llamadasGet().some((u) => u.includes('searchTerm=sap&'))).toBe(true))
    // Ni "s" ni "sa": una sola búsqueda con el término final.
    expect(llamadasGet().filter((u) => u.includes('searchTerm='))).toHaveLength(1)
  })

  it('muestra "Mostrando N de M" con el total del servidor y el chip de stock que decide el servidor', async () => {
    renderPantalla()
    expect(await screen.findByText('MOSTRANDO 2 DE 57')).toBeTruthy()
    expect(await screen.findByText('Hay stock')).toBeTruthy()
    expect(screen.getByText('Sin stock')).toBeTruthy()
    expect(api.post).toHaveBeenCalledWith('/api/v1/Stocks/disponibilidad', {
      depositoId: 'dep-1',
      items: [
        { productoId: AER.id, cantidad: 1 },
        { productoId: TEX.id, cantidad: 1 },
      ],
    })
  })

  it('sin CAP_VER_COSTOS la ficha no dibuja costo ni margen, aunque llegaran', async () => {
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(screen.getByText('Se vende por caja de 12')).toBeTruthy()
    expect(screen.queryByText('Costo por unidad')).toBeNull()
    expect(screen.queryByText('Margen bruto')).toBeNull()
    expect(screen.queryByText(/1\.846,71/)).toBeNull()
    expect(screen.queryByText('40,0 %')).toBeNull()
  })

  it('con CAP_VER_COSTOS la ficha muestra costo y margen', async () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_COSTOS', canRead: true }])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    expect(await screen.findByText('$ 1.846,71')).toBeTruthy()
    expect(screen.getByText('40,0 %')).toBeTruthy()
  })

  it('sin un rol que vea cantidades no se piden ni se dibujan las cantidades por depósito', async () => {
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await screen.findByText('Precio de lista por unidad')

    expect(screen.queryByText('Stock por depósito')).toBeNull()
    expect(screen.queryByText('184 · 36 · 148')).toBeNull()
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/Stocks?'))).toBe(false)
  })

  it('con un rol que ve cantidades muestra real, reservado y disponible por depósito', async () => {
    conUsuario(['Gerencia'])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    expect(await screen.findByText('184 · 36 · 148')).toBeTruthy()
    expect(screen.getByText('Central')).toBeTruthy()
  })

  it('desde 900 px la grilla y la ficha van en dos paneles', async () => {
    mockAncho = 900
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    const panel = screen.getByTestId('panel-ficha')
    expect(await within(panel).findByText('Precio de lista por unidad')).toBeTruthy()
    // La lista sigue a la vista al lado de la ficha.
    expect(screen.getByLabelText(`${TEX.nombre}, código ${TEX.codigoPropio}`)).toBeTruthy()
  })

  it('debajo de 900 px no hay segundo panel', async () => {
    mockAncho = 899
    renderPantalla()
    await screen.findByText(AER.nombre)
    expect(screen.queryByTestId('panel-ficha')).toBeNull()
  })
})

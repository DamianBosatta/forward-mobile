import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoConsultaScreen from '../../../../app/(tabs)/inventario/index'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { fichaDeCatalogo, paginaDeCatalogo } from '../testing/fichasDeCatalogo'

// PR 1.1 — catálogo de consulta. Se renderiza la pantalla real con react-query real;
// solo se reemplaza el transporte HTTP (api.get / api.post) por respuestas del servidor.

let mockAncho = 390
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: mockAncho }) }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useFocusEffect: jest.fn() }))
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
  if (url.startsWith('/api/v1/catalogo?')) {
    // Lo que el servidor decide por ficha (descontando lo reservado): AER hay, TEX no.
    return Promise.resolve(paginaDeCatalogo([fichaDeCatalogo(AER), fichaDeCatalogo(TEX, { disponible: false })], 57, true))
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
      roles: roles as never,
      permissions: [{ module: 'MOD_CATALOGO', canRead: true }, { module: 'MOD_STOCK', canRead: true }, ...permissions] as never,
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
    expect(llamadasGet().some((u) => u.includes('SearchTerm='))).toBe(false)

    await waitFor(() => expect(llamadasGet().some((u) => u.includes('SearchTerm=sap'))).toBe(true))
    // Ni "s" ni "sa": una sola búsqueda con el término final.
    expect(llamadasGet().filter((u) => u.includes('SearchTerm='))).toHaveLength(1)
  })

  it('muestra "Mostrando N de M" con el total del servidor y el chip de stock que decide cada ficha del catálogo', async () => {
    renderPantalla()
    expect(await screen.findByText('MOSTRANDO 2 DE 57')).toBeTruthy()
    expect(await screen.findByText('Hay stock')).toBeTruthy()
    expect(screen.getByText('Sin stock')).toBeTruthy()
    // La tarjeta no pide nada a Stock: el vendedor sin ese módulo no recibe 403.
    expect(api.post).not.toHaveBeenCalled()
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/Productos') || u.startsWith('/api/v1/Stocks'))).toBe(false)
  })

  it('la ficha, sin depósito en el perfil, consulta la disponibilidad del Depósito Central', async () => {
    expect(useAuthStore.getState().user?.depositoId).toBeUndefined()
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(api.post.mock.calls[0][1].depositoId).toBe(DEPOSITO_CENTRAL_ID)
  })

  it('la ficha, con depósito en el perfil, consulta ese', async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, depositoId: 'dep-1' } })
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(api.post.mock.calls[0][1].depositoId).toBe('dep-1')
  })

  it('un producto totalmente reservado dice "Sin stock" en la tarjeta y en la ficha, aunque tenga stock físico', async () => {
    // El servidor descuenta lo reservado: disponible=false para el producto, pero el detalle dice puedeVenderse.
    api.get.mockImplementation((url: string) =>
      url.startsWith('/api/v1/catalogo?')
        ? Promise.resolve(paginaDeCatalogo([fichaDeCatalogo(AER, { disponible: false }), fichaDeCatalogo(TEX, { disponible: false })]))
        : servidor(url),
    )
    api.post.mockResolvedValue([{ productoId: AER.id, disponible: false }])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await screen.findByText('Precio de lista por unidad')
    await waitFor(() => expect(screen.getAllByText('Sin stock').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByText('Hay stock')).toBeNull()
  })

  it('la ficha también pide la disponibilidad con la venta mínima, aparte del chip', async () => {
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await screen.findByText('Se vende por caja de 12')
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/v1/Stocks/disponibilidad', {
        depositoId: DEPOSITO_CENTRAL_ID,
        items: [{ productoId: AER.id, cantidad: 12 }],
      }),
    )
  })

  describe('stock 5 con venta mínima 12', () => {
    // El servidor responde según la cantidad pedida: alcanza para 1, no para 12.
    const stockCinco = (_url: string, body: { items: { productoId: string; cantidad: number }[] }) =>
      Promise.resolve(body.items.map((i) => ({ productoId: i.productoId, disponible: i.cantidad <= 5 })))

    it('la tarjeta y la ficha dicen lo mismo y la ficha avisa que no alcanza la caja', async () => {
      api.post.mockReset().mockImplementation(stockCinco)
      renderPantalla()
      await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
      await screen.findByText('Se vende por caja de 12')
      expect(await screen.findByText('No alcanza para la venta mínima (caja de 12)')).toBeTruthy()
      // Tarjeta (AER) y ficha: ambas "Hay stock"; nunca "Sin stock" para AER.
      await waitFor(() => expect(screen.getAllByText('Hay stock').length).toBeGreaterThanOrEqual(2))
    })

    it('con stock de sobra no hay aviso de venta mínima', async () => {
      api.post.mockReset().mockImplementation((_u: string, body: { items: { productoId: string }[] }) =>
        Promise.resolve(body.items.map((i) => ({ productoId: i.productoId, disponible: true }))),
      )
      renderPantalla()
      await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
      await screen.findByText('Se vende por caja de 12')
      await waitFor(() => expect(api.post.mock.calls.some(([, b]) => b.items[0]?.cantidad === 12)).toBe(true))
      expect(screen.queryByText(/No alcanza para la venta mínima/)).toBeNull()
    })
  })

  it('el catálogo no muestra costos ni margen ni precio mínimo, ni con CAP_VER_COSTOS (S6, como la web)', async () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_COSTOS', canRead: true }])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(screen.getByText('Se vende por caja de 12')).toBeTruthy()
    expect(screen.queryByText('Costo y margen')).toBeNull()
    expect(screen.queryByText('Costo por unidad')).toBeNull()
    expect(screen.queryByText('Margen bruto')).toBeNull()
    expect(screen.queryByText('Precio mínimo')).toBeNull()
    expect(screen.queryByText(/1\.846,71/)).toBeNull()
    expect(screen.queryByText(/2\.585,39/)).toBeNull()
    expect(screen.queryByText('40,0 %')).toBeNull()
  })

  it('el catálogo no muestra cantidades ni pide el stock por depósito, ni con CAP_VER_CANTIDADES_STOCK (S6)', async () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await screen.findByText('Precio de lista por unidad')

    expect(screen.queryByText('Stock por depósito')).toBeNull()
    expect(screen.queryByText('184 · 36 · 148')).toBeNull()
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/Stocks?'))).toBe(false)
  })

  it('la ficha dice el estado del producto', async () => {
    renderPantalla()
    await abrirFichaDeAer()
    expect(await screen.findByText('Activo')).toBeTruthy()
  })

  it('el filtro "Con stock" deja solo lo que el servidor dice que se puede vender, y al apagarlo vuelve todo', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    const tarjetaAer = screen.getByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`)
    await waitFor(() => expect(within(tarjetaAer).getByText('Hay stock')).toBeTruthy())

    await userEvent.press(screen.getByRole('button', { name: 'Con stock', selected: false }))
    expect(screen.queryByText(TEX.nombre)).toBeNull()
    expect(screen.getByText(AER.nombre)).toBeTruthy()
    expect(screen.getByText('MOSTRANDO 1 DE 57')).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: 'Con stock', selected: true }))
    expect(screen.getByText(TEX.nombre)).toBeTruthy()
  })

  it('no tiene el selector Catálogo/Stock: el stock es otra pantalla', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    expect(screen.queryByRole('radio', { name: 'Stock' })).toBeNull()
  })

  it('"Ver stock por depósito" lleva a la pantalla Stock buscando ese código', async () => {
    mockPush.mockClear()
    renderPantalla()
    await abrirFichaDeAer()
    await userEvent.press(await screen.findByLabelText('Ver stock por depósito'))

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/inventario/stock', params: { busqueda: AER.codigoPropio } })
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

const abrirFichaDeAer = async () => userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
const LINEA = { id: 'p-lin', nombre: 'Saphirus Difusor', codigoPropio: 'SAP-DIF', precioVenta: 5200 }

/** El servidor con otra lista del catálogo (y, si se quiere, otro detalle de AER). */
function servidorCon(items: object[], detalle: object = DETALLE) {
  return (url: string) => {
    if (url.startsWith('/api/v1/catalogo?')) return Promise.resolve(paginaDeCatalogo(items))
    if (url === `/api/v1/Productos/${AER.id}`) return Promise.resolve(detalle)
    return servidor(url)
  }
}

describe('Catálogo: fichas de /catalogo', () => {
  it('una línea muestra cuántas fragancias tiene y el chip de si alguna tiene stock', async () => {
    api.get.mockImplementation(servidorCon([fichaDeCatalogo(LINEA, { fragancias: ['Coco', 'Vainilla', 'Lavanda'], disponible: true })]))
    renderPantalla()

    expect(await screen.findByText('3 fragancias')).toBeTruthy()
    expect(screen.getByText('Hay stock')).toBeTruthy()
  })

  it('un producto suelto no dice "fragancias"', async () => {
    api.get.mockImplementation(servidorCon([fichaDeCatalogo(AER)]))
    renderPantalla()

    await screen.findByText(AER.nombre)
    expect(screen.queryByText(/fragancia/)).toBeNull()
  })

  it('aunque el detalle mande la última compra y los costos, la ficha no los dibuja (S6)', async () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_COSTOS', canRead: true }])
    const ultima = { fecha: '2026-10-11T01:30:00Z', proveedorNombre: 'Distribuidora Norte S.A.', costoUnitario: 1846.71, variacionCostoPorcentaje: 5.2 }
    api.get.mockImplementation(servidorCon([fichaDeCatalogo(AER), fichaDeCatalogo(TEX)], { ...DETALLE, ultimaCompra: ultima }))
    renderPantalla()
    await abrirFichaDeAer()

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(screen.queryByText(/Última compra/)).toBeNull()
    expect(screen.queryByText(/Distribuidora Norte/)).toBeNull()
    expect(screen.queryByText('Costo y margen')).toBeNull()
  })
})

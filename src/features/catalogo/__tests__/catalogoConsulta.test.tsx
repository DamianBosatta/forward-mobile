import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoConsultaScreen from '../../../../app/(tabs)/inventario/index'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { fichaDeCatalogo, paginaDeCatalogo } from '../testing/fichasDeCatalogo'
import { novedadesDesde } from '../lib/presentacion'
import { formatImporte } from '@/core/ui/fw'

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
  productoId: AER.id,
  nombre: AER.nombre,
  codigoPropio: AER.codigoPropio,
  precioVenta: AER.precioVenta,
  esPadreDeVariantes: false,
  precioMinimoRentable: 2585.39,
  precioCompraBase: 1846.71,
  margenBrutoPorcentaje: 40,
  ventaMinimaUnidades: 12,
  disponible: true,
  disponibleVentaMinima: true,
  codigoBarra: '7798114820536',
  marca: 'Saphirus',
  variantes: [],
}
const fichaDeAer = (url: string) => url.startsWith(`/api/v1/catalogo/${AER.id}?`)

function servidor(url: string) {
  if (url.startsWith('/api/v1/catalogo?')) {
    // Lo que el servidor decide por ficha (descontando lo reservado): AER hay, TEX no.
    return Promise.resolve(paginaDeCatalogo([fichaDeCatalogo(AER), fichaDeCatalogo(TEX, { disponible: false })], 57, true))
  }
  if (fichaDeAer(url)) return Promise.resolve(DETALLE)
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
    expect(await screen.findByText('2 de 57 productos')).toBeTruthy()
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
    await waitFor(() => expect(llamadasGet()).toContain(`/api/v1/catalogo/${AER.id}?depositoId=${DEPOSITO_CENTRAL_ID}`))
  })

  it('la ficha, con depósito en el perfil, consulta ese', async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, depositoId: 'dep-1' } })
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await waitFor(() => expect(llamadasGet()).toContain(`/api/v1/catalogo/${AER.id}?depositoId=dep-1`))
  })

  it('un usuario con solo el catálogo abre la ficha sin pedirle nada a Productos ni a Stock', async () => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'u', roles: ['Vendedor'] as never, permissions: [{ module: 'MOD_CATALOGO', canRead: true }] as never },
    })
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText('Hay stock').length).toBeGreaterThanOrEqual(2))
    expect(api.post).not.toHaveBeenCalled()
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/Productos') || u.startsWith('/api/v1/Stocks'))).toBe(false)
  })

  it('un producto totalmente reservado dice "Sin stock" en la tarjeta y en la ficha, aunque tenga stock físico', async () => {
    // El servidor descuenta lo reservado: disponible=false en la tarjeta y en la ficha.
    api.get.mockImplementation(
      servidorCon([fichaDeCatalogo(AER, { disponible: false }), fichaDeCatalogo(TEX, { disponible: false })], {
        ...DETALLE,
        disponible: false,
        disponibleVentaMinima: false,
      }),
    )
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await screen.findByText('Precio de lista por unidad')
    await waitFor(() => expect(screen.getAllByText('Sin stock').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByText('Hay stock')).toBeNull()
  })

  describe('stock 5 con venta mínima 12', () => {
    // El servidor resuelve los dos chequeos: alcanza para 1, no para la caja de 12.
    it('la tarjeta y la ficha dicen lo mismo y la ficha avisa que no alcanza la caja', async () => {
      api.get.mockImplementation(servidorCon([fichaDeCatalogo(AER), fichaDeCatalogo(TEX)], { ...DETALLE, disponibleVentaMinima: false }))
      renderPantalla()
      await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
      await screen.findByText('Bulto · venta mínima')
      expect(await screen.findByText('No alcanza para la venta mínima (caja de 12)')).toBeTruthy()
      // Tarjeta (AER) y ficha: ambas "Hay stock"; nunca "Sin stock" para AER.
      await waitFor(() => expect(screen.getAllByText('Hay stock').length).toBeGreaterThanOrEqual(2))
    })

    it('con stock de sobra no hay aviso de venta mínima', async () => {
      renderPantalla()
      await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
      await screen.findByText('Bulto · venta mínima')
      expect(screen.queryByText(/No alcanza para la venta mínima/)).toBeNull()
    })
  })

  it('el catálogo no muestra costos ni margen ni precio mínimo, ni con CAP_VER_COSTOS (S6, como la web)', async () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_COSTOS', canRead: true }])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(screen.getByText('Bulto · venta mínima')).toBeTruthy()
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

  it('el filtro "Con stock" deja solo lo que el servidor dice que se puede vender, y al apagarlo vuelve todo', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    const tarjetaAer = screen.getByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`)
    await waitFor(() => expect(within(tarjetaAer).getByText('Hay stock')).toBeTruthy())

    await userEvent.press(screen.getByRole('button', { name: 'Con stock', selected: false }))
    expect(screen.queryByText(TEX.nombre)).toBeNull()
    expect(screen.getByText(AER.nombre)).toBeTruthy()
    expect(screen.getByText('1 de 57 productos')).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: 'Con stock', selected: true }))
    expect(screen.getByText(TEX.nombre)).toBeTruthy()
  })

  it('no tiene el selector Catálogo/Stock: el stock es otra pantalla', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    expect(screen.queryByRole('radio', { name: 'Stock' })).toBeNull()
  })

  it('"Ver stock en vivo de este producto" lleva a la pantalla Stock buscando ese código', async () => {
    mockPush.mockClear()
    renderPantalla()
    await abrirFichaDeAer()
    await userEvent.press(await screen.findByLabelText('Ver stock en vivo de este producto'))

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
    if (fichaDeAer(url)) return Promise.resolve(detalle)
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

describe('Catálogo: novedades', () => {
  it('pide las novedades de los últimos 30 días y pinta cada tarjeta con la marca del servidor', async () => {
    const NUE = { id: 'p-nue', nombre: 'Balde 10 L con tapa', codigoPropio: 'NUV-BAL-10', precioVenta: 4850 }
    api.get.mockImplementation((url: string) =>
      url.startsWith('/api/v1/catalogo?')
        ? Promise.resolve(paginaDeCatalogo([
            fichaDeCatalogo(AER, { novedad: 'PrecioNuevo', precioAnterior: 2836.73, variacionPorcentaje: 8.5 }),
            fichaDeCatalogo(TEX, { disponible: false, novedad: 'SinStock' }),
            fichaDeCatalogo(NUE, { novedad: 'Nuevo' }),
          ]))
        : servidor(url),
    )
    renderPantalla()

    expect(await screen.findByLabelText('Saphirus Aerosol 250 ml, código SAP-AER-250, Precio nuevo, ▲ 8,5 %')).toBeTruthy()
    expect(screen.getByText('$ 2.836,73')).toBeTruthy()
    expect(screen.getByLabelText('Saphirus Textil 250 ml, código SAP-TEX-250, Sin stock')).toBeTruthy()
    expect(screen.getByLabelText('Balde 10 L con tapa, código NUV-BAL-10, Nuevo')).toBeTruthy()

    const pedido = new URL(`http://x${llamadasGet().find((u) => u.startsWith('/api/v1/catalogo?'))}`)
    expect(pedido.searchParams.get('NovedadesDesde')).toBe(novedadesDesde(30))
  })
})

describe('Catálogo: ficha, "Cómo se vende"', () => {
  it('lista la unidad y el bulto de venta mínima con su precio; sin pack porque la API no lo manda', async () => {
    renderPantalla()
    await abrirFichaDeAer()

    expect(await screen.findByText('Cómo se vende')).toBeTruthy()
    expect(screen.getByText('Unidad')).toBeTruthy()
    expect(screen.getByText('1 u.')).toBeTruthy()
    expect(screen.getByText('Bulto · venta mínima')).toBeTruthy()
    expect(screen.getByText('12 u.')).toBeTruthy()
    expect(screen.getByText(formatImporte(AER.precioVenta * 12))).toBeTruthy()
    expect(screen.queryByText('Pack')).toBeNull()
  })

  it('el precio de lista y "Cómo se vende" van juntos en una sola tarjeta', async () => {
    renderPantalla()
    await abrirFichaDeAer()

    const tarjeta = await screen.findByTestId('ficha-precio-tarjeta')
    expect(within(tarjeta).getByText('Precio de lista por unidad')).toBeTruthy()
    expect(within(tarjeta).getByText('Cómo se vende')).toBeTruthy()
    expect(within(tarjeta).getByText('Bulto · venta mínima')).toBeTruthy()
  })

  it('un producto que se vende por unidad solo tiene la fila Unidad', async () => {
    api.get.mockImplementation(servidorCon([fichaDeCatalogo(AER), fichaDeCatalogo(TEX)], { ...DETALLE, ventaMinimaUnidades: 1 }))
    renderPantalla()
    await abrirFichaDeAer()

    await screen.findByText('Cómo se vende')
    expect(screen.getByText('Unidad')).toBeTruthy()
    expect(screen.queryByText(/Bulto/)).toBeNull()
  })

  it('un precio que cambió muestra el precio anterior y la variación también en la ficha', async () => {
    api.get.mockImplementation((url: string) =>
      url.startsWith('/api/v1/catalogo?')
        ? Promise.resolve(paginaDeCatalogo([fichaDeCatalogo(AER, { novedad: 'PrecioNuevo', precioAnterior: 2836.73, variacionPorcentaje: 8.5 })]))
        : servidor(url),
    )
    renderPantalla()
    await userEvent.press(await screen.findByLabelText('Saphirus Aerosol 250 ml, código SAP-AER-250, Precio nuevo, ▲ 8,5 %'))

    expect(await screen.findByText(`antes ${formatImporte(2836.73)}`)).toBeTruthy()
    expect(screen.getAllByText('▲ 8,5 %').length).toBeGreaterThanOrEqual(2)
  })
})

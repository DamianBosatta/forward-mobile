import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoConsultaScreen from '../../../../app/(tabs)/inventario/index'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { themeColors } from '@/libs/theme'

// PR 1.1 — catálogo de consulta. Se renderiza la pantalla real con react-query real;
// solo se reemplaza el transporte HTTP (api.get / api.post) por respuestas del servidor.

let mockAncho = 390
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: mockAncho }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }) }))
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
      depositoId: DEPOSITO_CENTRAL_ID,
      items: [
        { productoId: AER.id, cantidad: 1 },
        { productoId: TEX.id, cantidad: 1 },
      ],
    })
  })

  it('con un perfil sin depósito usa el Depósito Central y el chip aparece igual', async () => {
    expect(useAuthStore.getState().user?.depositoId).toBeUndefined()
    renderPantalla()
    expect(await screen.findByText('Hay stock')).toBeTruthy()
    expect(api.post.mock.calls[0][1].depositoId).toBe(DEPOSITO_CENTRAL_ID)
  })

  it('con depósito en el perfil, usa ese', async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, depositoId: 'dep-1' } })
    renderPantalla()
    await screen.findByText('Hay stock')
    expect(api.post.mock.calls[0][1].depositoId).toBe('dep-1')
  })

  it('un producto totalmente reservado dice "Sin stock" en la tarjeta y en la ficha, aunque tenga stock físico', async () => {
    // El servidor descuenta lo reservado: disponible=false para el producto, pero el detalle dice puedeVenderse.
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

  it('con CAP_VER_CANTIDADES_STOCK muestra real, reservado y disponible por depósito, aunque el rol sea Vendedor (forward-system #900)', async () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))

    expect(await screen.findByText('184 · 36 · 148')).toBeTruthy()
    expect(screen.getByText('Central')).toBeTruthy()
  })

  it('sin CAP_VER_CANTIDADES_STOCK no pide ni dibuja cantidades, aunque el rol sea Gerencia', async () => {
    conUsuario(['Gerencia'])
    renderPantalla()
    await userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
    await screen.findByText('Precio de lista por unidad')

    expect(screen.queryByText('Stock por depósito')).toBeNull()
    expect(llamadasGet().some((u) => u.startsWith('/api/v1/Stocks?'))).toBe(false)
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

// ── Adopción de forward-system #894 ──────────────────────────────────────────
// Servidor nuevo: el listado trae hayDisponible, cantidadFragancias y ventaMinimaUnidades, y el detalle la
// última compra. Mobile usa fragancias, venta mínima y última compra; NO usa hayDisponible (es de todos los
// depósitos y la ficha usa el del usuario): el chip sigue saliendo de POST /Stocks/disponibilidad con cantidad 1.
// Servidor anterior: nada de eso, y la pantalla se comporta como antes.

const LINEA = { id: 'p-lin', nombre: 'Saphirus Difusor', codigoPropio: 'SAP-DIF', precioVenta: 5200, esPadreDeVariantes: true, activo: true }

/** El servidor con otra lista de productos (y, si se quiere, otro detalle de AER). */
function servidorCon(items: object[], detalle: object = DETALLE) {
  return (url: string) => {
    if (url.startsWith('/api/v1/Productos?')) {
      return Promise.resolve({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false })
    }
    if (url === `/api/v1/Productos/${AER.id}`) return Promise.resolve(detalle)
    return servidor(url)
  }
}

const consultasDeDisponibilidad = () => api.post.mock.calls.filter(([url]) => url === '/api/v1/Stocks/disponibilidad')
const abrirFichaDeAer = async () => userEvent.press(await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`))
const colorDe = (texto: string): string => StyleSheet.flatten(screen.getByText(texto).props.style).color
const rojo = [themeColors.light.chip.anulado.text, themeColors.dark.chip.anulado.text]
const verde = [themeColors.light.chip.entregado.text, themeColors.dark.chip.entregado.text]
const neutro = [themeColors.light.textSecondary, themeColors.dark.textSecondary]

const ULTIMA = {
  // 01:30 UTC del 11 es la noche del 10 en Argentina (UTC-3).
  fecha: '2026-10-11T01:30:00Z',
  proveedorNombre: 'Distribuidora Norte S.A.',
  costoUnitario: 1846.71,
  variacionCostoPorcentaje: 5.2,
}

describe('Catálogo con servidor nuevo (forward-system #894)', () => {
  it('el chip sigue saliendo de la disponibilidad del depósito del usuario, con cantidad 1: hayDisponible no lo cambia', async () => {
    // hayDisponible (todos los depósitos) contradice a propósito la consulta por depósito.
    api.get.mockImplementation(
      servidorCon([
        { ...AER, hayDisponible: false, ventaMinimaUnidades: 12 },
        { ...TEX, hayDisponible: true, ventaMinimaUnidades: 6 },
      ]),
    )
    renderPantalla()

    const tarjetaAer = await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`)
    await waitFor(() => expect(within(tarjetaAer).getByText('Hay stock')).toBeTruthy())
    const tarjetaTex = screen.getByLabelText(`${TEX.nombre}, código ${TEX.codigoPropio}`)
    expect(within(tarjetaTex).getByText('Sin stock')).toBeTruthy()
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/api/v1/Stocks/disponibilidad', {
      depositoId: DEPOSITO_CENTRAL_ID,
      items: [
        { productoId: AER.id, cantidad: 1 },
        { productoId: TEX.id, cantidad: 1 },
      ],
    })
  })

  it('una línea muestra "12 fragancias · caja de 12" y sigue sin chip, aunque traiga hayDisponible', async () => {
    api.get.mockImplementation(
      servidorCon([{ ...LINEA, hayDisponible: true, cantidadFragancias: 12, ventaMinimaUnidades: 12 }]),
    )
    renderPantalla()

    expect(await screen.findByText('12 fragancias · caja de 12')).toBeTruthy()
    expect(screen.queryByText('Con fragancias')).toBeNull()
    expect(screen.queryByText('Hay stock')).toBeNull()
    expect(screen.queryByText('Sin stock')).toBeNull()
    expect(consultasDeDisponibilidad()).toHaveLength(0)
  })

  it('un producto que se vende por caja dice "caja de N"; por unidad no dice nada', async () => {
    api.get.mockImplementation(
      servidorCon([
        { ...AER, ventaMinimaUnidades: 6 },
        { ...TEX, ventaMinimaUnidades: 1 },
      ]),
    )
    renderPantalla()

    expect(await screen.findByText('caja de 6')).toBeTruthy()
    expect(screen.getAllByText(/caja de/)).toHaveLength(1)
  })

  describe('stock 5 con venta mínima 12 en el listado', () => {
    // El servidor responde según la cantidad pedida: alcanza para 1, no para 12.
    const stockCinco = (_url: string, body: { items: { productoId: string; cantidad: number }[] }) =>
      Promise.resolve(body.items.map((i) => ({ productoId: i.productoId, disponible: i.cantidad <= 5 })))

    it('la tarjeta consulta con cantidad 1 y dice lo mismo que la ficha, que aparte avisa que no alcanza la caja', async () => {
      api.get.mockImplementation(servidorCon([{ ...AER, ventaMinimaUnidades: 12 }, TEX]))
      api.post.mockReset().mockImplementation(stockCinco)
      renderPantalla()

      const tarjeta = await screen.findByLabelText(`${AER.nombre}, código ${AER.codigoPropio}`)
      await waitFor(() => expect(within(tarjeta).getByText('Hay stock')).toBeTruthy())
      expect(api.post).toHaveBeenCalledWith('/api/v1/Stocks/disponibilidad', {
        depositoId: DEPOSITO_CENTRAL_ID,
        items: [
          { productoId: AER.id, cantidad: 1 },
          { productoId: TEX.id, cantidad: 1 },
        ],
      })

      await userEvent.press(tarjeta)
      expect(await screen.findByText('No alcanza para la venta mínima (caja de 12)')).toBeTruthy()
      // Tarjeta (AER) y ficha: ambas "Hay stock"; nunca "Sin stock" para AER.
      await waitFor(() => expect(screen.getAllByText('Hay stock').length).toBeGreaterThanOrEqual(2))
    })
  })

  describe('última compra en el bloque de costos', () => {
    beforeEach(() => conUsuario(['Vendedor'], [{ module: 'CAP_VER_COSTOS', canRead: true }]))

    it('con CAP_VER_COSTOS muestra el día argentino, el proveedor, el costo y la variación con signo', async () => {
      api.get.mockImplementation(servidorCon([AER, TEX], { ...DETALLE, ultimaCompra: ULTIMA }))
      renderPantalla()
      await abrirFichaDeAer()

      expect(await screen.findByText('Última compra: 10/10/2026 · Distribuidora Norte S.A. · $ 1.846,71')).toBeTruthy()
      expect(screen.getByText('+5,2 % respecto de la compra anterior')).toBeTruthy()
      // Sigue el costo por unidad y el margen de antes.
      expect(screen.getByText('Costo por unidad')).toBeTruthy()
      expect(screen.getByText('40,0 %')).toBeTruthy()
    })

    it('si el costo sube la variación va en rojo y si baja, en verde', async () => {
      api.get.mockImplementation(servidorCon([AER, TEX], { ...DETALLE, ultimaCompra: ULTIMA }))
      const { unmount } = renderPantalla()
      await abrirFichaDeAer()
      await screen.findByText('+5,2 % respecto de la compra anterior')
      expect(rojo).toContain(colorDe('+5,2 % respecto de la compra anterior'))
      unmount()

      api.get.mockImplementation(
        servidorCon([AER, TEX], { ...DETALLE, ultimaCompra: { ...ULTIMA, variacionCostoPorcentaje: -3.04 } }),
      )
      renderPantalla()
      await abrirFichaDeAer()
      await screen.findByText('-3,0 % respecto de la compra anterior')
      expect(verde).toContain(colorDe('-3,0 % respecto de la compra anterior'))
    })

    // El color sale del valor redondeado que se escribe: "0,0 %" nunca va en rojo ni en verde, y ±0,05 redondean para el mismo lado.
    it.each([
      [0.05, '+0,1 % respecto de la compra anterior', rojo],
      [-0.05, '-0,1 % respecto de la compra anterior', verde],
      [0, '0,0 % respecto de la compra anterior', neutro],
      [0.04, '0,0 % respecto de la compra anterior', neutro],
      [-0.04, '0,0 % respecto de la compra anterior', neutro],
    ])('la variación %p se escribe "%s" y toma el color de ese valor', async (variacion, texto, colores) => {
      api.get.mockImplementation(
        servidorCon([AER, TEX], { ...DETALLE, ultimaCompra: { ...ULTIMA, variacionCostoPorcentaje: variacion } }),
      )
      renderPantalla()
      await abrirFichaDeAer()

      await screen.findByText(texto)
      expect(colores).toContain(colorDe(texto))
    })

    it('la primera compra (sin variación) no dibuja el renglón de la variación', async () => {
      api.get.mockImplementation(
        servidorCon([AER, TEX], {
          ...DETALLE,
          ultimaCompra: { ...ULTIMA, proveedorNombre: null, variacionCostoPorcentaje: null },
        }),
      )
      renderPantalla()
      await abrirFichaDeAer()

      // Sin proveedor, esa parte se omite.
      expect(await screen.findByText('Última compra: 10/10/2026 · $ 1.846,71')).toBeTruthy()
      expect(screen.queryByText(/respecto de la compra anterior/)).toBeNull()
    })

    it('la medianoche argentina cambia el día: 03:00 UTC ya es el 11', async () => {
      api.get.mockImplementation(
        servidorCon([AER, TEX], { ...DETALLE, ultimaCompra: { ...ULTIMA, fecha: '2026-10-11T03:00:00Z' } }),
      )
      renderPantalla()
      await abrirFichaDeAer()

      expect(await screen.findByText(/^Última compra: 11\/10\/2026/)).toBeTruthy()
    })

    it('si solo hay última compra (sin costo ni margen) el bloque de costos aparece igual', async () => {
      api.get.mockImplementation(
        servidorCon([AER, TEX], { ...DETALLE, precioCompraBase: null, margenBrutoPorcentaje: null, ultimaCompra: ULTIMA }),
      )
      renderPantalla()
      await abrirFichaDeAer()

      expect(await screen.findByText('Costo y margen')).toBeTruthy()
      expect(screen.getByText(/^Última compra:/)).toBeTruthy()
    })

    it('con ultimaCompra null no hay nada nuevo: se ve costo y margen como antes', async () => {
      api.get.mockImplementation(servidorCon([AER, TEX], { ...DETALLE, ultimaCompra: null }))
      renderPantalla()
      await abrirFichaDeAer()

      expect(await screen.findByText('$ 1.846,71')).toBeTruthy()
      expect(screen.queryByText(/Última compra/)).toBeNull()
    })
  })

  it('sin CAP_VER_COSTOS la ficha no dibuja la última compra, aunque llegara', async () => {
    api.get.mockImplementation(servidorCon([AER, TEX], { ...DETALLE, ultimaCompra: ULTIMA }))
    renderPantalla()
    await abrirFichaDeAer()

    expect(await screen.findByText('Precio de lista por unidad')).toBeTruthy()
    expect(screen.queryByText(/Última compra/)).toBeNull()
    expect(screen.queryByText(/Distribuidora Norte/)).toBeNull()
    expect(screen.queryByText(/respecto de la compra anterior/)).toBeNull()
    expect(screen.queryByText('Costo y margen')).toBeNull()
  })
})

describe('Catálogo con servidor anterior a #894', () => {
  it('sigue como hoy: chip por consulta con cantidad 1, la línea sin chip y "Con fragancias", sin "caja de"', async () => {
    api.get.mockImplementation(servidorCon([AER, TEX, LINEA]))
    renderPantalla()

    expect(await screen.findByText('Hay stock')).toBeTruthy()
    expect(screen.getByText('Sin stock')).toBeTruthy()
    // La línea no tiene stock propio: solo AER y TEX, y solo uno de cada chip.
    expect(screen.getAllByText('Hay stock')).toHaveLength(1)
    expect(screen.getAllByText('Sin stock')).toHaveLength(1)
    expect(screen.getByText('Con fragancias')).toBeTruthy()
    expect(screen.queryByText(/caja de/)).toBeNull()
    expect(consultasDeDisponibilidad()).toHaveLength(1)
    expect(api.post).toHaveBeenCalledWith('/api/v1/Stocks/disponibilidad', {
      depositoId: DEPOSITO_CENTRAL_ID,
      items: [
        { productoId: AER.id, cantidad: 1 },
        { productoId: TEX.id, cantidad: 1 },
      ],
    })
  })

  it('la ficha con CAP_VER_COSTOS muestra costo y margen y nada de última compra', async () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_COSTOS', canRead: true }])
    renderPantalla()
    await abrirFichaDeAer()

    expect(await screen.findByText('$ 1.846,71')).toBeTruthy()
    expect(screen.getByText('40,0 %')).toBeTruthy()
    expect(screen.queryByText(/Última compra/)).toBeNull()
  })
})

import React from 'react'
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CLAVE_CATALOGO } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { RevisarVenta } from '../components/RevisarVenta'
import { producto } from '../__testing__/producto'

const CAP = { module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }
let qc: QueryClient
let catalogoServidor: ReturnType<typeof producto>[]
// El servidor: el catálogo se pide con la queryFn del propio hook (un `setQueryDefaults` taparía una consulta sin queryFn).
const mockQueryFn = jest.fn(async () => ({ items: catalogoServidor, hasNextPage: false }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockQueryFn(...(a as [])), put: jest.fn(), post: jest.fn() },
}))
const cliente = { direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }

const rollo = (over = {}) => producto({ id: 'p1', nombre: 'Rollo 90x120', marca: 'Maxi Bag', precioVenta: 1000, disponible: 10, ...over })
const esponja = (over = {}) => producto({ id: 'p2', nombre: 'Esponja multiuso', marca: 'Brilhus', precioVenta: 400, disponible: 10, ...over })

function revisar(props: Partial<React.ComponentProps<typeof RevisarVenta>> = {}) {
  const alEditar = jest.fn()
  const alConfirmar = jest.fn()
  render(
    <QueryClientProvider client={qc}>
      <RevisarVenta cliente={cliente} descuentoGeneral={0} enviando={false} error={null} onConfirmar={alConfirmar} onEditarLinea={alEditar} {...props} />
    </QueryClientProvider>,
  )
  return { alEditar, alConfirmar }
}

beforeEach(() => {
  mockQueryFn.mockClear()
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [CAP] } as never })
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const vistos = [rollo(), esponja()]
  qc.setQueryData(CLAVE_CATALOGO, { items: vistos, truncado: false })
  useCarritoVenta.setState({ lineas: [
    { productoId: 'p1', producto: vistos[0], cantidad: 2, descuentoPct: 0 },
    { productoId: 'p2', producto: vistos[1], cantidad: 4, descuentoPct: 10 },
  ] })
  catalogoServidor = [rollo(), esponja()]
})

afterEach(() => { onlineManager.setOnline(true) })

describe('RevisarVenta (S5, S6, S7)', () => {
  it('muestra el cliente (dirección y nombre), las líneas con su subtotal y el total', async () => {
    revisar()
    expect(screen.getByText('Revisar venta')).toBeTruthy()
    expect(screen.getByText('Tarantino 1898')).toBeTruthy()
    expect(screen.getByText('Autoservicio Abel')).toBeTruthy()
    expect(screen.getByText('Maxi Bag')).toBeTruthy()
    expect(screen.getByText('Esponja multiuso')).toBeTruthy()
    expect(screen.getByText('2 u × $ 1.000,00')).toBeTruthy()
    expect(screen.getByText('−10 %')).toBeTruthy()
    // 2 × 1.000 + 4 × 400 con 10 % = 2.000 + 1.440
    expect(screen.getByTestId('revisar-total')).toHaveTextContent('$ 3.440,00')
    expect(screen.getByText('Subtotal de lista')).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText('Stock confirmado ahora')).toHaveLength(2))
  })

  it('con sinEncabezado la barra superior ya dice "Revisar venta" y la dirección: el cuerpo no las repite', async () => {
    revisar({ sinEncabezado: true })
    expect(screen.queryByText('Revisar venta')).toBeNull()
    expect(screen.queryByText('Tarantino 1898')).toBeNull()
    expect(screen.getByText('Productos')).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText('Stock confirmado ahora')).toHaveLength(2))
  })

  it('al abrir vuelve a pedir el stock; sin cambios no hay banner', async () => {
    revisar()
    await waitFor(() => expect(screen.getAllByText('Stock confirmado ahora')).toHaveLength(2))
    expect(mockQueryFn).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/El stock cambió mientras cargabas/)).toBeNull()
  })

  it('si el stock cambió después de cargar, marca la línea y el banner cuenta los productos', async () => {
    catalogoServidor = [rollo(), esponja({ disponible: 3 })]
    revisar()
    expect(await screen.findByText('El stock cambió mientras cargabas: revisá 1 producto.')).toBeTruthy()
    expect(screen.getByText('Quedan 3, pediste 4: tocá para ajustar')).toBeTruthy()
    expect(screen.getByTestId('linea-cambio-p2')).toBeTruthy()
    expect(screen.queryByTestId('linea-cambio-p1')).toBeNull()
  })

  it('editando, lo que la venta ya tenía se suma al disponible: no marca falta donde alcanza (S9)', async () => {
    // Quedan 3 en el catálogo sin la 1 u. que esta venta ya tenía: la línea de 4 alcanza.
    catalogoServidor = [rollo(), esponja({ disponible: 3 })]
    revisar({ yaReservadas: { p2: 1 } })
    expect(await screen.findByText('Stock actualizado: quedan 4')).toBeTruthy()
    expect(screen.queryByText(/Quedan 3, pediste 4/)).toBeNull()
  })

  it('editando, si pide más que disponible + lo que ya tenía, sigue marcando la falta con el disponible real', async () => {
    catalogoServidor = [rollo(), esponja({ disponible: 2 })]
    revisar({ yaReservadas: { p2: 1 } })
    expect(await screen.findByText('Quedan 3, pediste 4: tocá para ajustar')).toBeTruthy()
  })

  it('el botón puede llevar otra etiqueta (editar: "Guardar cambios")', () => {
    revisar({ etiquetaConfirmar: 'Guardar cambios' })
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar venta' })).toBeNull()
  })

  it('con dos productos cambiados el banner habla en plural', async () => {
    catalogoServidor = [rollo({ disponible: 1 }), esponja({ disponible: 3 })]
    revisar()
    expect(await screen.findByText('El stock cambió mientras cargabas: revisá 2 productos.')).toBeTruthy()
  })

  it('quien no ve cantidades no ve ningún número de stock en el aviso', async () => {
    useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], permissions: [] } as never })
    catalogoServidor = [rollo(), esponja({ disponible: 0, puedeVenderse: false })]
    revisar()
    expect(await screen.findByText('Sin stock ahora: tocá para ajustar')).toBeTruthy()
  })

  it('tocar una línea llama a onEditarLinea con esa línea', async () => {
    const { alEditar } = revisar()
    await userEvent.press(screen.getByRole('button', { name: /Esponja multiuso/ }))
    expect(alEditar).toHaveBeenCalledWith(expect.objectContaining({ productoId: 'p2', cantidad: 4 }))
  })

  it('Confirmar venta revalida el stock y recién después confirma; con faltante no se bloquea', async () => {
    catalogoServidor = [rollo(), esponja({ disponible: 3 })]
    const { alConfirmar } = revisar()
    await screen.findByText('Quedan 3, pediste 4: tocá para ajustar')
    expect(mockQueryFn).toHaveBeenCalledTimes(1)
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledTimes(1))
    expect(mockQueryFn).toHaveBeenCalledTimes(2)
  })

  it('muestra el error del servidor y deshabilita el botón mientras envía', () => {
    revisar({ error: 'No se pudo guardar la venta.', enviando: true })
    expect(screen.getByText('No se pudo guardar la venta.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
  })

  it('sin conexión no marca "Stock confirmado ahora" y confirmar sigue de inmediato (cola sin señal)', async () => {
    onlineManager.setOnline(false)
    const { alConfirmar } = revisar()
    expect(await screen.findAllByText('Sin conexión: el stock se revisa al enviar')).toHaveLength(2)
    expect(screen.queryByText('Stock confirmado ahora')).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledTimes(1))
    expect(mockQueryFn).not.toHaveBeenCalled()
  })

  it('mientras revalida al confirmar, el botón queda deshabilitado y no se confirma dos veces', async () => {
    const { alConfirmar } = revisar()
    await waitFor(() => expect(screen.getAllByText('Stock confirmado ahora')).toHaveLength(2))
    let soltar: () => void = () => {}
    mockQueryFn.mockImplementationOnce(() => new Promise((res) => { soltar = () => res({ items: catalogoServidor, hasNextPage: false }) }))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled())
    expect(alConfirmar).not.toHaveBeenCalled()
    soltar()
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledTimes(1))
  })
  it('dos toques seguidos en Confirmar venta (antes de re-renderizar) confirman una sola vez', async () => {
    const { alConfirmar } = revisar()
    await waitFor(() => expect(screen.getAllByText('Stock confirmado ahora')).toHaveLength(2))
    const boton = screen.getByRole('button', { name: 'Confirmar venta' })
    // Dos toques en el mismo cuadro: el segundo llega antes de que el botón se apague.
    await act(async () => { fireEvent.press(boton); fireEvent.press(boton) })
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(alConfirmar).toHaveBeenCalledTimes(1)
  })

  it('si el envío falla, se puede volver a confirmar', async () => {
    const { alConfirmar } = revisar()
    await waitFor(() => expect(screen.getAllByText('Stock confirmado ahora')).toHaveLength(2))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledTimes(1))
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar venta' }))
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledTimes(2))
  })

  describe('fragancias (S9)', () => {
    const variante = (id: string, nombre: string) => producto({ id, nombre, marca: 'Lysoform', precioVenta: 300, disponible: 10, productoPadreId: 'padre1' })
    beforeEach(() => {
      const a = variante('v1', 'Desodorante - Lavanda')
      const b = variante('v2', 'Desodorante - Pino')
      qc.setQueryData(CLAVE_CATALOGO, { items: [a, b, rollo()], truncado: false })
      catalogoServidor = [a, b, rollo()]
      useCarritoVenta.setState({ lineas: [
        { productoId: 'v1', producto: a, cantidad: 2, descuentoPct: 0 },
        { productoId: 'v2', producto: b, cantidad: 3, descuentoPct: 0 },
        { productoId: 'p1', producto: rollo(), cantidad: 1, descuentoPct: 0 },
      ] })
    })

    it('una línea con fragancias ofrece "Elegir fragancias" una sola vez por producto padre y abre la elección', async () => {
      const alElegir = jest.fn()
      revisar({ onElegirFragancias: alElegir })
      const botones = screen.getAllByRole('button', { name: 'Elegir fragancias de Desodorante' })
      expect(botones).toHaveLength(1)
      await userEvent.press(botones[0])
      expect(alElegir).toHaveBeenCalledWith('padre1')
    })

    it('un producto sin fragancias no ofrece elegirlas', () => {
      revisar({ onElegirFragancias: jest.fn() })
      expect(screen.queryByRole('button', { name: /Elegir fragancias de Rollo/ })).toBeNull()
    })
  })

  it('abre con el aviso de autorización arriba, la sección Productos con Editar y los descuentos de línea', async () => {
    const alEditarProductos = jest.fn()
    revisar({ autorizacion: ['un descuento supera tu tope', 'el cliente tiene deuda de más de 30 días'], onEditarProductos: alEditarProductos })
    expect(screen.getByText('Esta venta necesita autorización')).toBeTruthy()
    expect(screen.getByText(/Un descuento supera tu tope\./)).toBeTruthy()
    expect(screen.getByText(/Podés confirmarla igual: queda en Por autorizar\./)).toBeTruthy()
    expect(screen.getByText('Productos')).toBeTruthy()
    expect(screen.getByText('Descuentos de línea')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Editar productos' }))
    expect(alEditarProductos).toHaveBeenCalledTimes(1)
  })

  it('sin motivos de autorización no hay aviso', () => {
    revisar()
    expect(screen.queryByText('Esta venta necesita autorización')).toBeNull()
  })
})

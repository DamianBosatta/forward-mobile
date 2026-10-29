import React from 'react'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CatalogoVenta } from '../components/CatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { cajaDe6, producto } from '../__testing__/producto'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
const conAncho = (width: number) => mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 })

const mockProductos = [
  producto({ precioVenta: 1000, real: 37, disponible: 37 }),
  cajaDe6({ precioVenta: 500, puedeVenderse: false }),
  producto({ id: 'pf', nombre: 'Saphirus Aerosol', esPadreDeVariantes: true }),
  producto({ id: 'pv', nombre: 'Saphirus Aerosol Lavanda', productoPadreId: 'pf' }),
]
jest.mock('../hooks/useCatalogoVenta', () => ({
  useCatalogoVenta: () => ({ productos: mockProductos, isLoading: false }),
}))

// El escáner real usa la cámara: acá lee los códigos que se le tocan.
jest.mock('@/features/catalogo/components/EscanerCodigo', () => ({
  EscanerCodigo: ({ visible, onLeido }: { visible: boolean; onLeido: (c: string) => void }) => {
    if (!visible) return null
    const { Pressable: P, Text: T } = require('react-native')
    return <>{['7790001112223', '0000'].map((c) => <P key={c} accessibilityRole="button" onPress={() => onLeido(c)}><T>{`Leer ${c}`}</T></P>)}</>
  },
}))

// La vista previa de la línea (servidor) tiene sus propios tests en EditarLineaSheet.test.tsx.
jest.mock('@/libs/api-client/ventas', () => ({
  ...jest.requireActual('@/libs/api-client/ventas'),
  useVistaPreviaLinea: () => ({ data: undefined }),
}))

const conUsuario = (roles: string[], permissions: { module: string; canRead: boolean }[] = []) => useAuthStore.setState({ user: { roles, permissions } as never })

beforeEach(() => {
  conAncho(390)
  conUsuario(['Vendedor'])
  useCarritoVenta.setState({ lineas: [] })
})

describe('CatalogoVenta (agregar productos)', () => {
  it('"+ Añadir" en una caja de 6 pasa a − 6 +; restar la saca del carrito', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.getByText('Bulto x 6 u')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Bettanin Pala Rebatible' }))
    expect(within(screen.getByTestId('producto-p6')).getByLabelText('Cantidad: 6')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Bettanin Pala Rebatible' }))
    expect(within(screen.getByTestId('producto-p6')).getByLabelText('Cantidad: 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Restar Bettanin Pala Rebatible' }))
    await userEvent.press(screen.getByRole('button', { name: 'Restar Bettanin Pala Rebatible' }))
    expect(useCarritoVenta.getState().lineas).toEqual([])
    expect(screen.getByRole('button', { name: 'Añadir Bettanin Pala Rebatible' })).toBeTruthy()
  })

  it('el vendedor ve "Hay stock / Sin stock" y no la cantidad', () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(within(screen.getByTestId('producto-p1')).getByText('Hay stock')).toBeTruthy()
    expect(within(screen.getByTestId('producto-p6')).getByText('Sin stock')).toBeTruthy()
    expect(screen.queryByText(/37/)).toBeNull()
  })

  it('con CAP_VER_CANTIDADES_STOCK ve la cantidad que manda el servidor, aunque el rol sea Vendedor (forward-system #900)', () => {
    conUsuario(['Vendedor'], [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }])
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(within(screen.getByTestId('producto-p1')).getByText('Quedan 37 u')).toBeTruthy()
  })

  it('sin CAP_VER_CANTIDADES_STOCK ve solo "Hay stock", aunque el rol sea Gerencia', () => {
    conUsuario(['Gerencia'])
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(within(screen.getByTestId('producto-p1')).getByText('Hay stock')).toBeTruthy()
    expect(screen.queryByText(/37/)).toBeNull()
  })

  it('el carrito flotante muestra los ítems y el total estimado (precio del servidor × cantidad)', async () => {
    const onVerVenta = jest.fn()
    render(<CatalogoVenta onVerVenta={onVerVenta} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Bettanin Pala Rebatible' }))
    expect(screen.getByTestId('carrito-items')).toHaveTextContent('2')
    expect(screen.getByText('2 productos · 1 bulto · 1 u')).toBeTruthy()
    expect(screen.getByTestId('carrito-total')).toHaveTextContent('$ 4.000,00')
    await userEvent.press(screen.getByRole('button', { name: /^Ver venta/ }))
    expect(onVerVenta).toHaveBeenCalled()
  })

  it('V4: el encabezado con la búsqueda y los filtros es oscuro (color de la barra superior)', () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.getByTestId('catalogo-encabezado')).toHaveStyle({ backgroundColor: '#0E1514' })
    expect(within(screen.getByTestId('catalogo-encabezado')).getByLabelText('Producto, marca o código')).toBeTruthy()
    expect(within(screen.getByTestId('catalogo-encabezado')).getByRole('button', { name: 'Hay stock' })).toBeTruthy()
  })

  it('V4: la barra del carrito se ve siempre: sin productos dice 0 y "Ver venta" no responde', async () => {
    const onVerVenta = jest.fn()
    render(<CatalogoVenta onVerVenta={onVerVenta} />)
    const barra = screen.getByTestId('carrito-barra')
    expect(within(barra).getByText('0 productos')).toBeTruthy()
    expect(within(barra).getByTestId('carrito-total')).toHaveTextContent('$ 0,00')
    const boton = within(barra).getByRole('button', { name: /^Ver venta/ })
    expect(boton).toBeDisabled()
    await userEvent.press(boton)
    expect(onVerVenta).not.toHaveBeenCalled()
  })

  it('V4: la barra del carrito fija abajo muestra el primer producto, dice cuántos y el total, y sigue a la venta', async () => {
    const onVerVenta = jest.fn()
    render(<CatalogoVenta onVerVenta={onVerVenta} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
    const barra = screen.getByTestId('carrito-barra')
    expect(within(barra).getByText('1 producto · 1 u')).toBeTruthy()
    expect(within(barra).getByTestId('carrito-total')).toHaveTextContent('$ 1.000,00')
    expect(within(barra).getByRole('button', { name: /^Ver venta/ })).toHaveStyle({ backgroundColor: '#2BD4BD' })
    await userEvent.press(within(barra).getByText('Ver venta'))
    expect(onVerVenta).toHaveBeenCalledTimes(1)
  })

  it('tocar el número abre Cantidad y descuento y lo confirmado vuelve al carrito', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
    await userEvent.press(screen.getByRole('button', { name: 'Cantidad: 1' }))
    await userEvent.press(screen.getByRole('button', { name: 'Borrar todo' }))
    await userEvent.press(screen.getByRole('button', { name: '4' }))
    await userEvent.press(screen.getByRole('button', { name: 'Otro descuento' }))
    await userEvent.type(screen.getByLabelText('Descuento (%)'), '5')
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(useCarritoVenta.getState().lineas[0]).toMatchObject({ cantidad: 4, descuentoPct: 5 })
    expect(screen.queryByLabelText('Cantidad y descuento')).toBeNull()
  })

  it('las variantes de una línea no se ofrecen como productos sueltos; el contador no las cuenta', () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.queryByText('Saphirus Aerosol Lavanda')).toBeNull()
    expect(screen.queryByTestId('producto-pv')).toBeNull()
    expect(screen.getByText('Mostrando 3 de 3')).toBeTruthy()
  })

  it('el total del carrito aplica el descuento de la línea', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
    await userEvent.press(screen.getByRole('button', { name: 'Cantidad: 1' }))
    await userEvent.press(screen.getByRole('button', { name: 'Otro descuento' }))
    await userEvent.type(screen.getByLabelText('Descuento (%)'), '10')
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(screen.getByTestId('carrito-total')).toHaveTextContent('$ 900,00')
  })

  it('desde Cantidad y descuento se llega al detalle de la línea (precio, stock y margen)', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
    await userEvent.press(screen.getByRole('button', { name: 'Cantidad: 1' }))
    await userEvent.press(screen.getByRole('link', { name: 'Ver precio, stock y margen' }))
    expect(screen.getByTestId('editar-linea')).toBeTruthy()
  })

  it('tablet horizontal: el carrito queda fijo a la derecha', () => {
    conAncho(1194)
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.getByTestId('carrito-panel')).toBeTruthy()
    expect(screen.getByText('Todavía no agregaste productos.')).toBeTruthy()
  })
})

describe('CatalogoVenta: filtros y escáner (V4)', () => {
  it('"Con oferta" deja los que tienen precio con oferta; "Hay stock", los que se pueden vender', async () => {
    mockProductos.push(producto({ id: 'po', nombre: 'Make Lavajean', precioConOferta: 90 }))
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Con oferta' }))
    expect(screen.getByTestId('producto-po')).toBeTruthy()
    expect(screen.queryByTestId('producto-p1')).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Con oferta' }))
    await userEvent.press(screen.getByRole('button', { name: 'Hay stock' }))
    expect(screen.queryByTestId('producto-p6')).toBeNull()
    expect(screen.getByTestId('producto-p1')).toBeTruthy()
    mockProductos.pop()
  })

  it('"Del último pedido" solo se ofrece si hay último pedido, y deja lo que llevó con la pista de cuánto', async () => {
    const { unmount } = render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Del último pedido' })).toBeNull()
    unmount()
    render(<CatalogoVenta onVerVenta={jest.fn()} llevo={new Map([['p1', 12]])} />)
    expect(screen.getByText('Llevó 12 la última vez')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Del último pedido' }))
    expect(screen.getByTestId('producto-p1')).toBeTruthy()
    expect(screen.queryByTestId('producto-p6')).toBeNull()
  })

  it('escanear un código que está en el catálogo suma el producto al carrito', async () => {
    mockProductos[0] = producto({ precioVenta: 1000, real: 37, disponible: 37, codigoBarra: '7790001112223' })
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Escanear código de barras' }))
    await userEvent.press(screen.getByRole('button', { name: 'Leer 7790001112223' }))
    expect(useCarritoVenta.getState().lineas).toHaveLength(1)
    expect(useCarritoVenta.getState().lineas[0].productoId).toBe('p1')
    expect(screen.getByText('Sumaste Pala c/Cabo Fija LP.')).toBeTruthy()
  })

  it('un código que no está en el catálogo se deja en la búsqueda y lo dice', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Escanear código de barras' }))
    await userEvent.press(screen.getByRole('button', { name: 'Leer 0000' }))
    expect(useCarritoVenta.getState().lineas).toEqual([])
    expect(screen.getByText(/No encontramos ese código/)).toBeTruthy()
    expect(screen.getByLabelText('Producto, marca o código').props.value).toBe('0000')
  })

  it('"Escanear en la góndola" abre el escáner al entrar', () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} escanearAlAbrir />)
    expect(screen.getByRole('button', { name: 'Leer 7790001112223' })).toBeTruthy()
  })
})

describe('CatalogoVenta (propuesta T3)', () => {
  it('la barra del carrito dice productos y bultos: una caja de 6 cargada a 12 son 2 bultos', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Bettanin Pala Rebatible' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Bettanin Pala Rebatible' }))
    expect(within(screen.getByTestId('carrito-barra')).getByText('1 producto · 2 bultos')).toBeTruthy()
  })

  it('el pie dice cuántos muestra de cuántos tiene el catálogo, y el filtro lo achica', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.getByText('Mostrando 3 de 3')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Hay stock' }))
    expect(screen.getByText('Mostrando 2 de 3')).toBeTruthy()
  })

  it('con la señal en vivo muestra el chip "Stock en vivo"; sin conexión, "Sin conexión"; sin señal, nada', () => {
    const r = render(<CatalogoVenta onVerVenta={jest.fn()} enVivo />)
    expect(screen.getByText('Stock en vivo')).toBeTruthy()
    r.rerender(<CatalogoVenta onVerVenta={jest.fn()} enVivo={false} />)
    expect(screen.getByText('Sin conexión')).toBeTruthy()
    r.rerender(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.queryByText('Stock en vivo')).toBeNull()
  })

  it('con onAbrirOferta, Agregar la abre con el producto y no toca el carrito', async () => {
    const onAbrirOferta = jest.fn()
    render(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={onAbrirOferta} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Bettanin Pala Rebatible' }))
    expect(onAbrirOferta).toHaveBeenCalledWith(expect.objectContaining({ id: 'p6' }))
    expect(useCarritoVenta.getState().lineas).toHaveLength(0)
  })
})

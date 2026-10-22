import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CatalogoVenta } from '../components/CatalogoVenta'
import { LineasVenta } from '../components/LineasVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'
import { aAutoguardado } from '../lib/payload'
import { repartirFragancias } from '../lib/fragancias'
import { reemplazar } from '../lib/carrito'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a) },
}))

const padre = producto({ id: 'pf', nombre: 'Saphirus Aerosol', esPadreDeVariantes: true })
const lavanda = producto({ id: 'pv1', nombre: 'Saphirus Aerosol - Lavanda', productoPadreId: 'pf', ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Bulto', precioVenta: 1000 })
const coco = producto({ id: 'pv2', nombre: 'Saphirus Aerosol - Coco Vainilla', productoPadreId: 'pf', ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Bulto', precioVenta: 1000 })
const pala = producto()
const mockProductos = [pala, padre, lavanda, coco]
jest.mock('../hooks/useCatalogoVenta', () => ({
  useCatalogoVenta: () => ({ productos: mockProductos, isLoading: false }),
}))

function conQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mockDims.mockReturnValue({ width: 390, height: 800, scale: 2, fontScale: 1 })
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [] } as never })
  useCarritoVenta.setState({ lineas: [] })
  mockGet.mockReset().mockResolvedValue([
    { id: 'pv1', fraganciaNombre: 'Lavanda', puedeVenderse: true, activo: true },
    { id: 'pv2', fraganciaNombre: 'Coco Vainilla', puedeVenderse: true, activo: true },
  ])
})

describe('elegir fragancias (PR 2.4)', () => {
  it('desde el catálogo reparte la línea en variantes, de a la caja de cada una', async () => {
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Lavanda' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Lavanda' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Coco Vainilla' }))
    expect(screen.getByLabelText('Lavanda: 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([['pv1', 12], ['pv2', 6]])
    // La línea padre no viaja: cada fragancia es un ítem propio, como en la web.
    expect(aAutoguardado(useCarritoVenta.getState().lineas).items.map((i) => i.productoId)).toEqual(['pv1', 'pv2'])
  })

  it('la disponibilidad de cada fragancia es la del servidor en el depósito de la venta', async () => {
    mockGet.mockResolvedValue([
      { id: 'pv1', fraganciaNombre: 'Lavanda', puedeVenderse: true, activo: true },
      { id: 'pv2', fraganciaNombre: 'Coco Vainilla', puedeVenderse: false, activo: true },
    ])
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv2')).getByText('Sin stock')).toBeTruthy())
    expect(within(screen.getByTestId('fragancia-pv1')).getByText('Hay stock')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith(`/api/v1/Productos/pf/variantes?depositoId=${DEPOSITO_CENTRAL_ID}`)
  })

  it('en Líneas las fragancias van juntas bajo su línea y "Elegir fragancias" vuelve a repartir', async () => {
    useCarritoVenta.setState({ lineas: [
      { productoId: 'p1', producto: pala, cantidad: 1, descuentoPct: 0 },
      { productoId: 'pv1', producto: lavanda, cantidad: 12, descuentoPct: 5 },
    ] })
    const Pantalla = () => {
      const { lineas } = useCarritoVenta()
      const [abierta, setAbierta] = React.useState<string | null>(null)
      const { FraganciasSheet } = require('../components/FraganciasSheet')
      return (
        <>
          <LineasVenta lineas={lineas} porAutorizar={[]} rechazos={[]} descuentoGeneral={0} onDescuentoGeneral={jest.fn()} onSumar={jest.fn()} onRestar={jest.fn()} tope={10}
            onAgregar={jest.fn()} onEditar={jest.fn()} onElegirFragancias={setAbierta} nombrePadre={(id) => (id === 'pf' ? 'Saphirus Aerosol' : undefined)} />
          <FraganciasSheet padreId={abierta} onClose={() => setAbierta(null)} />
        </>
      )
    }
    conQuery(<Pantalla />)
    const grupo = screen.getByTestId('fragancias-pf')
    expect(within(grupo).getByText('Saphirus Aerosol · fragancias')).toBeTruthy()
    expect(within(grupo).getByText('Lavanda 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias de Saphirus Aerosol' }))
    expect(screen.getByLabelText('Lavanda: 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Coco Vainilla' }))
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    // La fragancia nueva toma el descuento que ya tenía la línea.
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad, l.descuentoPct])).toEqual([['p1', 1, 0], ['pv1', 12, 5], ['pv2', 6, 5]])
    expect(within(screen.getByTestId('fragancias-pf')).getByText('Coco Vainilla 6')).toBeTruthy()
  })

  it('dejar una fragancia en 0 la saca de la venta sin tocar las demás líneas', () => {
    const lineas = [
      { productoId: 'pv1', producto: lavanda, cantidad: 6, descuentoPct: 0 },
      { productoId: 'p1', producto: pala, cantidad: 1, descuentoPct: 0 },
    ]
    expect(repartirFragancias(lineas, 'pf', [lavanda, coco], { pv1: 0, pv2: 6 }, 0).map((l) => l.productoId)).toEqual(['pv2', 'p1'])
  })

  it('no deja pedir más que el stock disponible de cada fragancia (como la web)', async () => {
    useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }] } as never })
    mockGet.mockResolvedValue([
      { id: 'pv1', fraganciaNombre: 'Lavanda', puedeVenderse: true, stockDisponible: 8, activo: true },
      { id: 'pv2', fraganciaNombre: 'Coco Vainilla', puedeVenderse: false, stockDisponible: 0, activo: true },
    ])
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv1')).getByText('Stock: 8')).toBeTruthy())
    expect(within(screen.getByTestId('fragancia-pv2')).getByText('Sin stock')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Lavanda' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Lavanda' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Coco Vainilla' }))
    expect(screen.getByLabelText('Lavanda: 6')).toBeTruthy()
    expect(screen.getByLabelText('Coco Vainilla: 0')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([['pv1', 6]])
  })

  it('al confirmar vuelve a acotar lo que traía el carrito al stock disponible, en cajas enteras', async () => {
    useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }] } as never })
    useCarritoVenta.setState({ lineas: [
      { productoId: 'pv1', producto: lavanda, cantidad: 12, descuentoPct: 0 },
      { productoId: 'pv2', producto: coco, cantidad: 6, descuentoPct: 0 },
    ] })
    mockGet.mockResolvedValue([
      { id: 'pv1', fraganciaNombre: 'Lavanda', puedeVenderse: true, stockDisponible: 8, activo: true },
      { id: 'pv2', fraganciaNombre: 'Coco Vainilla', puedeVenderse: false, stockDisponible: 0, activo: true },
    ])
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv1')).getByText('Stock: 8')).toBeTruthy())
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([['pv1', 6]])
  })

  it('el descuento es uno solo para toda la línea de fragancias', async () => {
    useCarritoVenta.setState({ lineas: [{ productoId: 'pv1', producto: lavanda, cantidad: 6, descuentoPct: 5 }] })
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    const campo = screen.getByLabelText('Descuento (%)')
    expect(campo.props.value).toBe('5')
    await userEvent.clear(campo)
    await userEvent.type(campo, '8')
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Coco Vainilla' }))
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.descuentoPct])).toEqual([['pv1', 8], ['pv2', 8]])
    // Editar el descuento de una sola fragancia lo cambia en toda su línea, sin tocar otros productos.
    const [l1, l2] = useCarritoVenta.getState().lineas
    const otra = { productoId: 'p1', producto: pala, cantidad: 1, descuentoPct: 3 }
    expect(reemplazar([l1, l2, otra], { ...l2, descuentoPct: 10 }).map((l) => l.descuentoPct)).toEqual([10, 10, 3])
  })
})

describe('R5 Elegir fragancias: la venta y la última vez', () => {
  it('muestra las unidades y lo que suman con el descuento de la línea', async () => {
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Lavanda' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Coco Vainilla' }))
    expect(screen.getByText('12 unidades')).toBeTruthy()
    expect(screen.getByTestId('fragancias-subtotal')).toHaveTextContent('$ 12.000,00')
  })

  it('"Como la última vez" pone lo que llevó de cada fragancia; sin último pedido no se ofrece', async () => {
    const { unmount } = conQuery(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    expect(screen.queryByRole('button', { name: 'Como la última vez' })).toBeNull()
    unmount()
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} llevo={new Map([['pv1', 6], ['pv2', 12], ['p1', 3]])} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await userEvent.press(screen.getByRole('button', { name: 'Como la última vez' }))
    expect(screen.getByLabelText('Lavanda: 6')).toBeTruthy()
    expect(screen.getByLabelText('Coco Vainilla: 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([['pv1', 6], ['pv2', 12]])
  })
})


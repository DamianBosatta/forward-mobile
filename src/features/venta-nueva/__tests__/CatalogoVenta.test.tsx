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
  producto({ precioVenta: 1000, real: 37 }),
  cajaDe6({ precioVenta: 500, puedeVenderse: false }),
  producto({ id: 'pf', nombre: 'Saphirus Aerosol', esPadreDeVariantes: true }),
  producto({ id: 'pv', nombre: 'Saphirus Aerosol Lavanda', productoPadreId: 'pf' }),
]
jest.mock('../hooks/useCatalogoVenta', () => ({
  useCatalogoVenta: () => ({ productos: mockProductos, isLoading: false }),
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
    expect(screen.getByText('Se vende por caja de 6')).toBeTruthy()
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
    expect(within(screen.getByTestId('producto-p1')).getByText('Stock: 37')).toBeTruthy()
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
    expect(screen.getByText('Total estimado')).toBeTruthy()
    expect(screen.getByTestId('carrito-total')).toHaveTextContent('$ 4.000,00')
    await userEvent.press(screen.getByRole('button', { name: /^Ver venta/ }))
    expect(onVerVenta).toHaveBeenCalled()
  })

  it('"Descuento y detalle de la línea" abre Editar línea y lo confirmado vuelve al carrito', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
    await userEvent.press(screen.getByRole('link', { name: 'Descuento y detalle de la línea' }))
    await userEvent.type(screen.getByLabelText('Descuento (%)'), '5')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(useCarritoVenta.getState().lineas[0]).toMatchObject({ cantidad: 1, descuentoPct: 5 })
    expect(screen.queryByTestId('editar-linea')).toBeNull()
  })

  it('las variantes de una línea no se ofrecen como productos sueltos; el contador no las cuenta', () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.queryByText('Saphirus Aerosol Lavanda')).toBeNull()
    expect(screen.queryByTestId('producto-pv')).toBeNull()
    expect(screen.getByText('3 resultados')).toBeTruthy()
  })

  it('el total del carrito aplica el descuento de la línea', async () => {
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
    await userEvent.press(screen.getByRole('link', { name: 'Descuento y detalle de la línea' }))
    await userEvent.type(screen.getByLabelText('Descuento (%)'), '10')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByTestId('carrito-total')).toHaveTextContent('$ 900,00')
  })

  it('tablet horizontal: el carrito queda fijo a la derecha', () => {
    conAncho(1194)
    render(<CatalogoVenta onVerVenta={jest.fn()} />)
    expect(screen.getByTestId('carrito-panel')).toBeTruthy()
    expect(screen.getByText('Todavía no agregaste productos.')).toBeTruthy()
  })
})

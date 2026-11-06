import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CatalogoVenta } from '../components/CatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { producto } from '../__testing__/producto'
import { aAutoguardado } from '../lib/payload'
import { repartirFragancias } from '../lib/fragancias'
import { precioServidor, reemplazar } from '../lib/carrito'
import { formatImporte } from '@/core/ui/fw'

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
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await userEvent.type(screen.getByLabelText('Lavanda'), '12')
    await userEvent.type(screen.getByLabelText('Coco Vainilla'), '6')
    expect(screen.getByLabelText('Lavanda').props.value).toBe('12')
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
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv2')).getByText(/Sin stock/)).toBeTruthy())
    expect(within(screen.getByTestId('fragancia-pv1')).getByText(/Hay stock/)).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith(`/api/v1/Productos/pf/variantes?depositoId=${DEPOSITO_CENTRAL_ID}`)
  })

  it('dejar una fragancia en 0 la saca de la venta sin tocar las demás líneas', () => {
    const lineas = [
      { productoId: 'pv1', producto: lavanda, cantidad: 6, descuentoPct: 0 },
      { productoId: 'p1', producto: pala, cantidad: 1, descuentoPct: 0 },
    ]
    expect(repartirFragancias(lineas, 'pf', [lavanda, coco], { pv1: 0, pv2: 6 }, 0).map((l) => l.productoId)).toEqual(['pv2', 'p1'])
  })

  const conStock = (verCantidades: boolean) => {
    useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: verCantidades ? [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }] : [] } as never })
    mockGet.mockResolvedValue([
      { id: 'pv1', fraganciaNombre: 'Lavanda', puedeVenderse: true, stockDisponible: 8, activo: true },
      { id: 'pv2', fraganciaNombre: 'Coco Vainilla', puedeVenderse: false, stockDisponible: 0, activo: true },
    ])
  }

  it.each([[true, 'Solo hay 8'], [false, 'No hay tanto stock']])('más que el stock (ve cantidades: %s) avisa "%s", no deja confirmar y no baja lo escrito', async (ver, texto) => {
    conStock(ver)
    // Sin ver cantidades el stock es "hay / no hay": la fragancia sin stock (pv2) es la que no alcanza.
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv2')).getByText(/Sin stock/)).toBeTruthy())
    const [campo, fila] = ver ? ['Lavanda', 'fragancia-pv1'] : ['Coco Vainilla', 'fragancia-pv2']
    await userEvent.type(screen.getByLabelText(campo), ver ? '12' : '6')
    expect(within(screen.getByTestId(fila)).getByText(texto)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar a la venta' })).toBeDisabled()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas).toEqual([])
    expect(screen.getByLabelText(campo).props.value).toBe(ver ? '12' : '6')
  })

  it('corregir al stock quita el aviso y agrega exactamente lo escrito', async () => {
    conStock(true)
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv1')).getByText(/Stock: 8/)).toBeTruthy())
    const campo = screen.getByLabelText('Lavanda')
    await userEvent.type(campo, '12')
    await userEvent.clear(campo)
    await userEvent.type(campo, '6')
    expect(screen.queryByText(/Solo hay/)).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([['pv1', 6]])
  })

  it('si el múltiplo y el stock fallan a la vez, gana "Se vende de a"', async () => {
    conStock(true)
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv1')).getByText(/Stock: 8/)).toBeTruthy())
    await userEvent.type(screen.getByLabelText('Lavanda'), '13')
    expect(screen.getByText('Se vende de a 6')).toBeTruthy()
    expect(screen.queryByText(/Solo hay/)).toBeNull()
  })

  it('"Como la última vez" acota al stock al llenar los campos y se ve antes de confirmar', async () => {
    conStock(true)
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} llevo={new Map([['pv1', 12], ['pv2', 6]])} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv1')).getByText(/Stock: 8/)).toBeTruthy())
    await userEvent.press(screen.getByRole('button', { name: 'Como la última vez' }))
    expect(screen.getByLabelText('Lavanda').props.value).toBe('6')
    expect(screen.getByRole('button', { name: 'Agregar a la venta' })).toBeEnabled()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([['pv1', 6]])
  })

  it('lo que traía el carrito y ya no hay en stock se avisa, no se baja solo', async () => {
    conStock(true)
    useCarritoVenta.setState({ lineas: [{ productoId: 'pv1', producto: lavanda, cantidad: 12, descuentoPct: 0 }] })
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await waitFor(() => expect(within(screen.getByTestId('fragancia-pv1')).getByText('Solo hay 8')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Agregar a la venta' })).toBeDisabled()
    expect(screen.getByLabelText('Lavanda').props.value).toBe('12')
  })

  it('el descuento es uno solo para toda la línea de fragancias', async () => {
    useCarritoVenta.setState({ lineas: [{ productoId: 'pv1', producto: lavanda, cantidad: 6, descuentoPct: 5 }] })
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    const campo = screen.getByLabelText('Descuento (%)')
    expect(campo.props.value).toBe('5')
    await userEvent.clear(campo)
    await userEvent.type(campo, '8')
    await userEvent.type(screen.getByLabelText('Coco Vainilla'), '6')
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
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await userEvent.type(screen.getByLabelText('Lavanda'), '6')
    await userEvent.type(screen.getByLabelText('Coco Vainilla'), '6')
    expect(screen.getByText('12 unidades')).toBeTruthy()
    expect(screen.getByTestId('fragancias-subtotal')).toHaveTextContent('$ 12.000,00')
  })

  it('"Como la última vez" pone lo que llevó de cada fragancia; sin último pedido no se ofrece', async () => {
    const { unmount } = conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    expect(screen.queryByRole('button', { name: 'Como la última vez' })).toBeNull()
    unmount()
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} llevo={new Map([['pv1', 6], ['pv2', 12], ['p1', 3]])} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await userEvent.press(screen.getByRole('button', { name: 'Como la última vez' }))
    expect(screen.getByLabelText('Lavanda').props.value).toBe('6')
    expect(screen.getByLabelText('Coco Vainilla').props.value).toBe('12')
    await userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
    expect(useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([['pv1', 6], ['pv2', 12]])
  })
})

describe('S8 y S9: cantidad tipeada en cada fragancia', () => {
  const abrir = async () => {
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
  }
  const agregar = () => userEvent.press(screen.getByRole('button', { name: 'Agregar a la venta' }))
  const cantidades = () => useCarritoVenta.getState().lineas.map((l) => [l.productoId, l.cantidad])

  it('no hay flechitas: ni − ni + ni botones de sumar o restar', async () => {
    await abrir()
    expect(screen.queryByRole('button', { name: /^(Sumar|Restar) / })).toBeNull()
    expect(screen.queryByText('−')).toBeNull()
    expect(screen.queryByText('+')).toBeNull()
  })

  it('cada fragancia es un campo numérico con su nombre, que al enfocar selecciona todo', async () => {
    await abrir()
    const campo = screen.getByLabelText('Lavanda')
    expect(campo.props.keyboardType).toBe('number-pad')
    expect(campo.props.selectTextOnFocus).toBe(true)
  })

  it('tipear 24 deja 24 y confirmar agrega 24; vacío cuenta como 0', async () => {
    await abrir()
    await userEvent.type(screen.getByLabelText('Lavanda'), '24')
    expect(screen.getByLabelText('Lavanda').props.value).toBe('24')
    expect(screen.queryByText(/Se vende de a/)).toBeNull()
    await agregar()
    expect(cantidades()).toEqual([['pv1', 24]])
  })

  it('tipear de nuevo sobre lo seleccionado reemplaza el valor (24 a 36)', async () => {
    await abrir()
    const campo = screen.getByLabelText('Lavanda')
    await userEvent.type(campo, '24')
    await userEvent.clear(campo)
    await userEvent.type(campo, '36')
    expect(screen.getByLabelText('Lavanda').props.value).toBe('36')
  })

  it('tipear 25 en un producto que se vende de a 6 avisa "Se vende de a 6" y no deja confirmar', async () => {
    await abrir()
    await userEvent.type(screen.getByLabelText('Lavanda'), '25')
    expect(within(screen.getByTestId('fragancia-pv1')).getByText('Se vende de a 6')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar a la venta' })).toBeDisabled()
    await agregar()
    expect(cantidades()).toEqual([])
    // Nunca se baja solo: sigue valiendo 25 hasta que el vendedor lo arregle.
    expect(screen.getByLabelText('Lavanda').props.value).toBe('25')
  })

  it('al corregir 25 a 24 el aviso se va y confirma con 24', async () => {
    await abrir()
    const campo = screen.getByLabelText('Lavanda')
    await userEvent.type(campo, '25')
    await userEvent.clear(campo)
    await userEvent.type(campo, '24')
    expect(screen.queryByText(/Se vende de a/)).toBeNull()
    await agregar()
    expect(cantidades()).toEqual([['pv1', 24]])
  })

  it('"Como la última vez" llena los campos con lo que llevó', async () => {
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} llevo={new Map([['pv1', 24], ['pv2', 36]])} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
    await userEvent.press(screen.getByRole('button', { name: 'Como la última vez' }))
    expect(screen.getByLabelText('Lavanda').props.value).toBe('24')
    expect(screen.getByLabelText('Coco Vainilla').props.value).toBe('36')
    await agregar()
    expect(cantidades()).toEqual([['pv1', 24], ['pv2', 36]])
  })
})

describe('S8: fila compacta aprobada de fragancia', () => {
  const abrir = async () => {
    conQuery(<CatalogoVenta onVerVenta={jest.fn()} onAbrirOferta={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Elegir fragancias' }))
  }
  const aplanar = (st: unknown) => Object.assign({}, ...[st].flat(Infinity).filter(Boolean)) as Record<string, number>
  const filaTextos = (id: string) => within(screen.getByTestId(`fragancia-${id}`)).queryAllByText(/./).map((n) => String(n.props.children))

  it('regla 1: el precio va una vez en el encabezado y en la fila solo si difiere', async () => {
    const padreOriginal = mockProductos[1]
    const padreA1000 = { ...padre, precioVenta: 1000 }
    mockProductos[1] = padreA1000
    mockProductos.push(producto({ id: 'pv3', nombre: 'Saphirus Aerosol - Rosa', productoPadreId: 'pf', ventaMinimaUnidades: 1, fraccionMinimaVenta: 'Unidad', precioVenta: 1500 }))
    try {
      await abrir()
      const precioPadre = formatImporte(precioServidor(padreA1000))
      expect(screen.getByText(`${precioPadre} c/u · 3 fragancias`)).toBeTruthy()
      expect(filaTextos('pv1').join(' ')).not.toContain('$')
      expect(filaTextos('pv3').join(' ')).toContain(formatImporte(1500))
    } finally { mockProductos.pop(); mockProductos[1] = padreOriginal }
  })

  it('regla 2: nombre y campo en la primera línea; abajo "Stock: N · de a M" y el error, sin chip alto', async () => {
    await abrir()
    const textos = filaTextos('pv1')
    expect(textos[0]).toBe('Saphirus Aerosol - Lavanda'.replace('Saphirus Aerosol - ', ''))
    expect(textos[1]).toMatch(/de a 6/)
    const st = aplanar(screen.getByLabelText('Lavanda').props.style)
    expect(st.width).toBeGreaterThanOrEqual(88)
    expect(st.width).toBeLessThanOrEqual(100)
    expect(st.height).toBeGreaterThanOrEqual(44)
    await userEvent.type(screen.getByLabelText('Lavanda'), '25')
    expect(within(screen.getByTestId('fragancia-pv1')).getByText('Se vende de a 6')).toBeTruthy()
  })

  it('regla 3: sin cantidad el campo está vacío (no dice 0) y cuenta como 0', async () => {
    await abrir()
    const campo = screen.getByLabelText('Lavanda')
    expect(campo.props.value).toBe('')
    expect(campo.props.placeholder).toBeUndefined()
    expect(screen.getByText('0 unidades')).toBeTruthy()
  })

  it('regla 5: teclado numérico, "siguiente" pasa a la fragancia que sigue y la última cierra', async () => {
    await abrir()
    expect(screen.getByLabelText('Lavanda').props.keyboardType).toBe('number-pad')
    expect(screen.getByLabelText('Lavanda').props.returnKeyType).toBe('next')
    expect(screen.getByLabelText('Coco Vainilla').props.returnKeyType).toBe('done')
    expect(screen.getByLabelText('Lavanda').props.submitBehavior).toBe('submit')
    expect(screen.getByLabelText('Coco Vainilla').props.submitBehavior).toBe('blurAndSubmit')
  })

  it('regla 6: unidades, total y botón siguen, con el descuento en una fila compacta', async () => {
    await abrir()
    const st = aplanar(screen.getByLabelText('Descuento (%)').props.style)
    expect(st.width).toBeLessThanOrEqual(100)
    await userEvent.type(screen.getByLabelText('Lavanda'), '12')
    expect(screen.getByText('12 unidades')).toBeTruthy()
    expect(screen.getByTestId('fragancias-subtotal')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar a la venta' })).toBeTruthy()
  })
})

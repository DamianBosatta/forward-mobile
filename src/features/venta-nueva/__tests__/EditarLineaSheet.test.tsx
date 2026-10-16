import React from 'react'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { pctFromPrecio, precioFromPct } from '@/features/ventas/lib/descuentos'
import { EditarLineaSheet } from '../components/EditarLineaSheet'
import { leerNumero } from '../lib/linea'
import type { LineaCarrito } from '../lib/carrito'
import { cajaDe6, producto } from '../__testing__/producto'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

const VER_COSTOS = { module: 'CAP_VER_COSTOS', canRead: true }
const EXENTO = { module: 'CAP_EXENTO_TOPE_DESCUENTO', canRead: true }
const conUsuario = (maxDescuentoPorcentaje: number, permissions: object[] = []) =>
  useAuthStore.setState({ user: { roles: ['Vendedor'], permissions, maxDescuentoPorcentaje } as never })

const linea = (over: Partial<LineaCarrito> = {}): LineaCarrito => {
  const p = producto({ precioCompraBase: 1410, costoDirecto: 1500, precioMinimoRentable: 2000 })
  return { productoId: p.id, producto: p, cantidad: 12, descuentoPct: 0, ...over }
}

function abrir(l = linea(), onConfirm = jest.fn(), descuentoGeneral?: number) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><EditarLineaSheet linea={l} onClose={jest.fn()} onConfirm={onConfirm} onQuitar={jest.fn()} descuentoGeneral={descuentoGeneral} /></QueryClientProvider>)
  return onConfirm
}
const escribir = async (campo: string, texto: string) => {
  const input = screen.getByLabelText(campo)
  await userEvent.clear(input)
  await userEvent.type(input, texto)
}
const valor = (campo: string) => leerNumero(screen.getByLabelText(campo).props.value)

beforeEach(() => {
  conUsuario(10)
  mockGet.mockReset().mockResolvedValue(undefined)
  mockPost.mockReset().mockResolvedValue(undefined)
})

describe('EditarLineaSheet: descuento % ↔ precio con descuento (descuentos.ts)', () => {
  it('el % calcula el precio igual que precioFromPct', async () => {
    abrir()
    await escribir('Descuento (%)', '12,82')
    expect(valor('Precio con descuento ($)')).toBe(precioFromPct(2496, 12.82))
  })

  it('el precio calcula el % igual que pctFromPrecio', async () => {
    abrir()
    await escribir('Precio con descuento ($)', '2176')
    expect(valor('Descuento (%)')).toBe(pctFromPrecio(2496, 2176))
  })

  it('confirma con la cantidad y el % elegidos; el precio lo pone el servidor', async () => {
    const onConfirm = abrir()
    await escribir('Descuento (%)', '5')
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 12, descuentoPct: 5 }))
  })
})

describe('EditarLineaSheet: entradas inválidas (es-AR)', () => {
  const confirmar = () => screen.getByRole('button', { name: 'Confirmar' })

  it('leerNumero entiende el punto de miles y la coma decimal; lo mal formado es inválido', () => {
    expect(leerNumero('1.500')).toBe(1500)
    expect(leerNumero('2.176,50')).toBe(2176.5)
    expect(leerNumero('12,82')).toBe(12.82)
    expect(leerNumero('')).toBeNull()
    expect(leerNumero('abc')).toBeNull()
    expect(leerNumero('1,2,3')).toBeNull()
    expect(leerNumero('-5')).toBeNull()
  })

  it.each([
    ['12.345.678', 12345678],
    ['12.5', 12.5],
    ['2176.50', 2176.5],
    ['0.75', 0.75],
    ['0.500', 0.5],
    ['0.125', 0.125],
    ['0.500,5', null],
    ['12,5', 12.5],
    ['12,', 12],
    ['12.', 12],
    ['1.2.3,4.5', null],
    ['1.2.3', null],
    ['.5', null],
    [',', null],
    ['.', null],
  ])('leerNumero(%j) → %j (acepta punto decimal y separador final)', (texto, esperado) => {
    expect(leerNumero(texto)).toBe(esperado)
  })

  it('"1.500" en el precio es 1500, no 1,5', async () => {
    abrir({ ...linea(), producto: producto({ precioVenta: 2000 }) })
    await escribir('Precio con descuento ($)', '1.500')
    expect(valor('Descuento (%)')).toBe(25)
  })

  it('borrar el precio no manda 100 %: avisa y no deja confirmar', async () => {
    const onConfirm = abrir()
    await userEvent.clear(screen.getByLabelText('Precio con descuento ($)'))
    expect(screen.getByText(/Ingresá un precio entre/)).toBeTruthy()
    await userEvent.press(confirmar())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('un % mayor a 100 o negativo avisa y no deja confirmar', async () => {
    const onConfirm = abrir()
    await escribir('Descuento (%)', '150')
    expect(screen.getByText(/entre 0 y 100/)).toBeTruthy()
    await userEvent.press(confirmar())
    await escribir('Descuento (%)', '-5')
    expect(screen.getByText(/entre 0 y 100/)).toBeTruthy()
    await userEvent.press(confirmar())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('un precio mayor a la lista avisa y no deja confirmar; corregido, confirma', async () => {
    const onConfirm = abrir()
    await escribir('Precio con descuento ($)', '3000')
    expect(screen.getByText(/Ingresá un precio entre/)).toBeTruthy()
    await userEvent.press(confirmar())
    expect(onConfirm).not.toHaveBeenCalled()
    await escribir('Precio con descuento ($)', '2496')
    expect(screen.queryByText(/Ingresá un precio entre/)).toBeNull()
    await userEvent.press(confirmar())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ descuentoPct: 0 }))
  })

  it('arranca con los valores de la línea ya en el primer render', () => {
    abrir(linea({ descuentoPct: 10, cantidad: 12 }))
    expect(screen.getByLabelText('Descuento (%)').props.value).toBe('10')
    expect(screen.getByLabelText('Unidades: 12')).toBeTruthy()
  })

  it('si cambia el objeto de la línea con la hoja abierta, no pisa lo que se tipeó', async () => {
    const l = linea()
    const props = { onClose: jest.fn(), onConfirm: jest.fn(), onQuitar: jest.fn() }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(<QueryClientProvider client={qc}><EditarLineaSheet linea={l} {...props} /></QueryClientProvider>)
    await escribir('Descuento (%)', '7')
    rerender(<QueryClientProvider client={qc}><EditarLineaSheet linea={{ ...l }} {...props} /></QueryClientProvider>)
    expect(screen.getByLabelText('Descuento (%)').props.value).toBe('7')
  })
})

describe('EditarLineaSheet: múltiplo de la unidad de venta', () => {
  it('en caja de 6, + suma 6 y − no baja del mínimo', async () => {
    abrir({ ...linea(), productoId: 'p6', producto: cajaDe6(), cantidad: 6 })
    await userEvent.press(screen.getByRole('button', { name: 'Sumar' }))
    expect(screen.getByLabelText('Unidades: 12')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Restar' }))
    await userEvent.press(screen.getByRole('button', { name: 'Restar' }))
    expect(screen.getByLabelText('Unidades: 6')).toBeTruthy()
  })
})

describe('EditarLineaSheet: avisos', () => {
  it('pasarse del tope avisa que va a quedar por autorizar; dentro del tope, nada', async () => {
    abrir()
    await escribir('Descuento (%)', '8')
    expect(screen.queryByText(/Tu tope de descuento es 10 %/)).toBeNull()
    await escribir('Descuento (%)', '12,82')
    expect(screen.getByText(/Tu tope de descuento es 10 %/)).toBeTruthy()
    expect(screen.getByText(/va a quedar por autorizar/)).toBeTruthy()
  })

  it('sin tope configurado cualquier descuento rebota, salvo con la exención', async () => {
    conUsuario(0)
    abrir()
    await escribir('Descuento (%)', '1')
    expect(screen.getByText(/No tenés un límite de descuento configurado/)).toBeTruthy()
    screen.unmount()
    conUsuario(0, [EXENTO])
    abrir()
    await escribir('Descuento (%)', '1')
    expect(screen.queryByText(/No tenés un límite/)).toBeNull()
  })

  it('debajo del precio mínimo: amarillo; debajo del costo: rojo', async () => {
    conUsuario(50)
    abrir()
    await escribir('Descuento (%)', '25')
    expect(screen.getByText(/Debajo del precio mínimo/)).toBeTruthy()
    await escribir('Descuento (%)', '45')
    expect(screen.getByText(/Debajo del costo/)).toBeTruthy()
  })
})

describe('EditarLineaSheet: costos solo con CAP_VER_COSTOS', () => {
  it('sin la capacidad no se dibuja costo, margen ni su etiqueta', () => {
    abrir()
    expect(screen.queryByTestId('costos-linea')).toBeNull()
    expect(screen.queryByText(/Precio de compra|Margen/)).toBeNull()
  })

  it('con la capacidad ve el precio de compra y el margen de la línea', () => {
    conUsuario(10, [VER_COSTOS])
    abrir()
    expect(screen.getByText('Precio de compra')).toBeTruthy()
    expect(screen.getByText('$ 1.410,00')).toBeTruthy()
    expect(screen.getByText('43,51 % · en verde')).toBeTruthy()
  })
})

describe('EditarLineaSheet: fragancias no pasan su stock disponible', () => {
  const lavanda = producto({ id: 'pv1', nombre: 'Saphirus - Lavanda', productoPadreId: 'pf', ventaMinimaUnidades: 6, fraccionMinimaVenta: 'Bulto', real: 100 })
  const abrirFragancia = (cantidad: number) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><EditarLineaSheet linea={{ productoId: 'pv1', producto: lavanda, cantidad, descuentoPct: 0 }} onClose={jest.fn()} onConfirm={jest.fn()} onQuitar={jest.fn()} /></QueryClientProvider>)
  }

  it('con stock 8 y cajas de 6, + llega a 6 y ahí queda (el stock es el del servidor, no el del catálogo)', async () => {
    conUsuario(10)
    useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }], maxDescuentoPorcentaje: 10 } as never })
    mockGet.mockResolvedValue([{ id: 'pv1', fraganciaNombre: 'Lavanda', puedeVenderse: true, stockDisponible: 8, activo: true }])
    abrirFragancia(6)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sumar' })).toBeDisabled())
    await userEvent.press(screen.getByRole('button', { name: 'Sumar' }))
    expect(screen.getByLabelText('Unidades: 6')).toBeTruthy()
  })

  it('con stock para dos cajas, + suma una caja y se detiene en 12', async () => {
    useAuthStore.setState({ user: { roles: ['Vendedor'], permissions: [{ module: 'CAP_VER_CANTIDADES_STOCK', canRead: true }], maxDescuentoPorcentaje: 10 } as never })
    mockGet.mockResolvedValue([{ id: 'pv1', fraganciaNombre: 'Lavanda', puedeVenderse: true, stockDisponible: 12, activo: true }])
    abrirFragancia(6)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await screen.findByLabelText('Unidades: 6')
    await userEvent.press(screen.getByRole('button', { name: 'Sumar' }))
    await userEvent.press(screen.getByRole('button', { name: 'Sumar' }))
    expect(screen.getByLabelText('Unidades: 12')).toBeTruthy()
  })
})

describe('EditarLineaSheet: vista previa del servidor (cierre del bloque 9)', () => {
  const VISTA = { productoId: 'p1', productoNombre: 'X', cantidad: 12, precioLista: 2496, precioBase: 2496, conOferta: false, precioEfectivo: 2496 }

  it('pide la vista previa con la cantidad, el descuento de la línea y el general de la venta', async () => {
    abrir(linea(), jest.fn(), 5)
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/vista-previa-linea',
      expect.objectContaining({ cantidad: 12, descuentoPorcentaje: 0, descuentoGeneral: 5 })))
  })

  it('sin CAP_VER_COSTOS, el rojo del servidor se avisa antes de guardar y no se dibuja margen', async () => {
    mockPost.mockResolvedValue({ ...VISTA, veredicto: 'Rojo', precioMinimoRentable: 2000, margenPorcentaje: null })
    abrir()
    expect(await screen.findByText('Debajo del costo.')).toBeTruthy()
    expect(within(screen.getByTestId('semaforo-linea')).getByText('Debajo del costo')).toBeTruthy()
    expect(screen.queryByTestId('costos-linea')).toBeNull()
  })

  it('con CAP_VER_COSTOS muestra el margen y el semáforo del servidor', async () => {
    conUsuario(10, [VER_COSTOS])
    mockPost.mockResolvedValue({ ...VISTA, veredicto: 'Amarillo', precioMinimoRentable: 2600, margenPorcentaje: 43.51 })
    abrir()
    expect(await screen.findByText('43,51 % · en amarillo')).toBeTruthy()
    expect(screen.getByText('Debajo del precio mínimo ($ 2.600,00).')).toBeTruthy()
  })

  it('sin respuesta del servidor quedan los avisos locales de siempre', async () => {
    mockPost.mockRejectedValue(new Error('sin red'))
    abrir()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(screen.queryByTestId('semaforo-linea')).toBeNull()
  })
})

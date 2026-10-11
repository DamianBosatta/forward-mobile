import React from 'react'
import { Alert } from 'react-native'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVentaNuevaStore } from '@/features/ventas/lib/ventaNueva'
import { VentaNuevaPantalla } from '../components/VentaNuevaPantalla'
import { useCarritoVenta } from '../hooks/useCarritoVenta'

const mockPost = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  Redirect: ({ href }: { href: string }) => mockBoton(`redirige a ${href}`, jest.fn()),
}))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))
// La hoja de cliente y el catálogo tienen sus tests: acá solo se elige y se agrega.
const mockBoton = (label: string, onPress: () => void) => {
  const { Pressable: P, Text: T } = require('react-native')
  return <P accessibilityRole="button" onPress={onPress}><T>{label}</T></P>
}
jest.mock('@/features/clientes/components/SeleccionarClienteSheet', () => ({
  SeleccionarClienteSheet: ({ onSelect }: { onSelect: (c: object, t: string) => void }) =>
    mockBoton('Elegir Tarantino', () => onSelect({ id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }, 'Pedido')),
}))
jest.mock('../components/CatalogoVenta', () => ({
  CatalogoVenta: () => mockBoton('Añadir pala', () =>
    require('../hooks/useCarritoVenta').useCarritoVenta.getState().agregar(require('../__testing__/producto').producto())),
}))

const { ApiError } = jest.requireActual('@/core/api/client')

function pantalla() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><VentaNuevaPantalla /></QueryClientProvider>)
}
const sync = () => screen.getByText(/Guardado|Guardando…|Sin guardar|Creando borrador…|Sin autoguardado/)
async function elegirCliente() {
  pantalla()
  await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
  await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
}
const anadir = () => userEvent.press(screen.getByRole('button', { name: 'Añadir pala' }))
const ESPERA = { timeout: 3000 }

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ ventaId: 'b1', version: 7, message: 'Borrador creado.' })
  mockPut.mockReset().mockImplementation((_u: string, body: { version: number }) => Promise.resolve({ ventaId: 'b1', version: body.version + 1, message: 'ok' }))
  mockBack.mockReset()
  useCarritoVenta.setState({ lineas: [] })
})

describe('venta nueva: cliente, borrador y autoguardado', () => {
  it('al elegir el cliente crea el borrador para ese cliente y lo nombra por la dirección', async () => {
    await elegirCliente()
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Ventas/borradores', { clienteId: 'c1', depositoId: DEPOSITO_CENTRAL_ID })
    expect(screen.getByText('Nuevo pedido')).toBeTruthy()
    expect(screen.getByText('Tarantino 1898 · Autoservicio Abel')).toBeTruthy()
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('autoguarda las líneas con la versión del borrador y encadena la que devuelve el servidor', async () => {
    await elegirCliente()
    await anadir()
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1), ESPERA)
    const items = [{ productoId: 'p1', cantidad: 1, descuentoPorcentaje: 0 }]
    expect(mockPut).toHaveBeenLastCalledWith('/api/v1/Ventas/b1', { id: 'b1', version: 7, descuentoGeneral: 0, metodoEntrega: 1, items })
    await waitFor(() => expect(sync()).toHaveTextContent('Guardado'))
    await anadir()
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2), ESPERA)
    expect(mockPut.mock.calls[1][1]).toMatchObject({ version: 8, items: [{ productoId: 'p1', cantidad: 2 }] })
  })

  it('si el servidor rechaza el guardado, se ve su motivo', async () => {
    mockPut.mockRejectedValue(new ApiError(400, 'No se pudo guardar.', ['El descuento supera tu tope.']))
    await elegirCliente()
    await anadir()
    expect(await screen.findByText(/El descuento supera tu tope\./, {}, ESPERA)).toBeTruthy()
    expect(sync()).toHaveTextContent('Sin guardar')
  })

  it('con un 409 (cambiado en otro lado) deja de guardar y lo avisa', async () => {
    mockPut.mockRejectedValue(new ApiError(409, 'Conflicto'))
    await elegirCliente()
    await anadir()
    expect(await screen.findByText(/se cambió desde otro lado/, {}, ESPERA)).toBeTruthy()
    await anadir()
    await new Promise((r) => setTimeout(r, 1000))
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it('si no se puede crear el borrador, se sigue armando la venta y se avisa', async () => {
    mockPost.mockRejectedValue(new ApiError(404, 'Cliente no encontrado o no es de tipo Cliente.'))
    pantalla()
    await userEvent.press(screen.getByRole('button', { name: 'Elegir Tarantino' }))
    expect(await screen.findByText(/Cliente no encontrado.*no se guarda sola/s)).toBeTruthy()
    expect(sync()).toHaveTextContent('Sin autoguardado')
    expect(screen.getByRole('button', { name: 'Añadir pala' })).toBeTruthy()
  })

  it('descartar borra el borrador en el servidor y vuelve', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => { void botones?.[1]?.onPress?.() })
    await elegirCliente()
    mockPost.mockResolvedValue(true)
    await userEvent.press(screen.getByRole('button', { name: 'Descartar borrador' }))
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
    expect(mockPost).toHaveBeenLastCalledWith('/api/v1/Ventas/b1/descartar-borrador')
  })
})

describe('ruta ventas/nueva-v2', () => {
  const Ruta = require('../../../../app/(tabs)/ventas/nueva-v2').default
  it('con el switch apagado lleva a la venta de hoy', () => {
    useAuthStore.setState({ user: { id: 'u', username: 'u', roles: ['Administrador'] as never, permissions: [] } })
    useVentaNuevaStore.setState({ activa: false })
    render(<Ruta />)
    expect(screen.getByText('redirige a /(tabs)/ventas/nueva')).toBeTruthy()
  })
})

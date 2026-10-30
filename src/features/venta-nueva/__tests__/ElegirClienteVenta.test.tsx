import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { storage } from '@/core/utils/storage'
import { formatImporte } from '@/core/ui/fw'
import { ElegirClienteVenta } from '../components/ElegirClienteVenta'

const mockCartera = jest.fn()
jest.mock('@/features/clientes/hooks/useCartera', () => ({ useCartera: (...a: unknown[]) => mockCartera(...a) }))
const mockFetchSocio = jest.fn()
let mockRecientes: object[] | undefined
jest.mock('@/libs/api-client/socios', () => ({
  ...jest.requireActual('@/libs/api-client/socios'),
  fetchSocio: (...a: unknown[]) => mockFetchSocio(...a),
  useClientesRecientes: () => ({ data: mockRecientes }),
  useLocalidades: () => ({ data: ['La Plata'] }),
}))
const jara = { id: 'c1', direccion: 'Jara 1643', nombreFantasia: 'Dietética', tieneDeudaVencida: false }
const alem = { id: 'c2', direccion: 'Alem 3669', nombreFantasia: 'Almacén Rosa', tieneDeudaVencida: true }

function abrir() {
  const onElegir = jest.fn()
  const onNuevoCliente = jest.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ElegirClienteVenta onElegir={onElegir} onNuevoCliente={onNuevoCliente} /></QueryClientProvider>)
  return { onElegir, onNuevoCliente }
}

beforeEach(() => {
  storage.clearAll()
  mockRecientes = undefined
  mockFetchSocio.mockReset()
  mockCartera.mockReset().mockReturnValue({ clientes: [jara, alem], isLoading: false, error: null, cargarMas: jest.fn(), totalCount: 2 })
  useAuthStore.setState({ user: { id: 'u1', roles: ['Vendedor'], permissions: [] } as never })
})

describe('V2 ¿A quién le vendés?', () => {
  it('lista la cartera por dirección, marca la deuda vencida y devuelve el cliente elegido (sin tipo: se elige en V3)', async () => {
    const { onElegir } = abrir()
    expect(screen.getByText('Jara 1643')).toBeTruthy()
    expect(screen.getByText('Deuda vencida')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Alem 3669, Almacén Rosa, deuda vencida' }))
    expect(onElegir).toHaveBeenCalledTimes(1)
    expect(onElegir.mock.calls[0]).toHaveLength(1)
    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2', direccion: 'Alem 3669' }))
  })

  it('la búsqueda y los filtros los hace el servidor: se los pasan a la cartera tal cual', async () => {
    abrir()
    await userEvent.type(screen.getByLabelText('Buscar cliente'), 'jara')
    expect(mockCartera).toHaveBeenLastCalledWith('jara', { conDeudaVencida: false })
    await userEvent.press(screen.getByRole('button', { name: 'Con deuda vencida' }))
    expect(mockCartera).toHaveBeenLastCalledWith('jara', { conDeudaVencida: true })
    await userEvent.press(screen.getByRole('button', { name: 'La Plata' }))
    expect(mockCartera).toHaveBeenLastCalledWith('jara', { conDeudaVencida: true, localidad: 'La Plata' })
  })

  it('un reciente se confirma con el servidor y se elige con el dato fresco', async () => {
    mockRecientes = [{ id: 'c1', direccion: 'Jara 1643' }]
    mockFetchSocio.mockResolvedValue({ ...jara, activo: true, direccion: 'Jara 1643 (nueva)' })
    const { onElegir } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Reciente: Jara 1643' }))
    await waitFor(() => expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', direccion: 'Jara 1643 (nueva)' })))
  })

  it('un reciente que el servidor niega o dio de baja no se elige y se avisa; una falla de red solo pide probar de nuevo', async () => {
    mockRecientes = [{ id: 'c1', direccion: 'Jara 1643' }]
    mockFetchSocio.mockRejectedValueOnce(Object.assign(new Error('no'), { status: 404 }))
    const { onElegir } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Reciente: Jara 1643' }))
    expect(await screen.findByText('Ese cliente ya no está disponible en tu cartera.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reciente: Jara 1643' })).toBeNull()
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('una falla de red al verificar un reciente lo deja ahí y pide probar de nuevo', async () => {
    mockRecientes = [{ id: 'c1', direccion: 'Jara 1643' }]
    mockFetchSocio.mockRejectedValueOnce(new TypeError('Network request failed'))
    const { onElegir } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Reciente: Jara 1643' }))
    expect(await screen.findByText('No se pudo verificar el cliente. Probá de nuevo.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reciente: Jara 1643' })).toBeTruthy()
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('Nuevo cliente lleva al alta', async () => {
    const { onNuevoCliente } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Nuevo cliente' }))
    expect(onNuevoCliente).toHaveBeenCalled()
  })

  it('sin clientes lo dice; buscando, dice que ninguno coincide', async () => {
    mockCartera.mockReturnValue({ clientes: [], isLoading: false, error: null, cargarMas: jest.fn(), totalCount: 0 })
    abrir()
    expect(screen.getByText('Todavía no hay clientes en tu cartera.')).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Buscar cliente'), 'zzz')
    expect(screen.getByText('Ningún cliente coincide con la búsqueda.')).toBeTruthy()
  })

  it('la fila del cliente elegido dice su último pedido (día argentino e importe); las demás no', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ElegirClienteVenta onElegir={jest.fn()} onNuevoCliente={jest.fn()} seleccionadoId="c1" ultimoPedido={{ fecha: '2026-10-25T01:30:00Z', total: 161200 }} /></QueryClientProvider>)
    expect(screen.getAllByText(`Último pedido 24/10 · ${formatImporte(161200)}`)).toHaveLength(1)
  })

  it('"Nuevo cliente" está en el encabezado de Tu cartera', () => {
    abrir()
    expect(screen.getByRole('header', { name: 'Tu cartera' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Nuevo cliente' })).toHaveLength(1)
  })
})

import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ArranqueVenta } from '../components/ArranqueVenta'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: (...a: unknown[]) => mockGet(...a) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }) }))
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }))

const cliente = { id: 'c1', direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }
const pedido = (id: string, fecha: string, over: Record<string, unknown> = {}) =>
  ({ id, fecha, estado: 'Entregada', tipoOperacion: 2, itemsCount: 12, totalAmount: 214560, ...over })

function servidor({ ventas = [] as object[], socio = {} as object } = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/Ventas?')) return Promise.resolve({ items: ventas, hasNextPage: false })
    if (url.startsWith('/api/v1/socios-comerciales/c1')) return Promise.resolve({ id: 'c1', direccion: 'Tarantino 1898', telefono: '11 5555-0000', ...socio })
    return Promise.resolve(undefined)
  })
}
function abrir(tipo: 'Pedido' | 'Presupuesto' = 'Pedido') {
  const onTipo = jest.fn()
  const onArrancar = jest.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ArranqueVenta cliente={cliente} tipo={tipo} onTipo={onTipo} onArrancar={onArrancar} /></QueryClientProvider>)
  return { onTipo, onArrancar }
}

beforeEach(() => { mockGet.mockReset(); mockPush.mockReset() })

describe('V3 Cómo arrancás', () => {
  it('Repetir el último pedido: la fecha, los productos y el total del último pedido, con los precios y el stock de hoy', async () => {
    servidor({ ventas: [pedido('v1', '2026-10-01T15:00:00Z'), pedido('v2', '2026-10-11T15:00:00Z', { itemsCount: 12 })] })
    const { onArrancar } = abrir()
    expect(await screen.findByText('11/10 · 12 productos · $ 214.560,00')).toBeTruthy()
    expect(screen.getByText('Con los precios y el stock de hoy')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Repetir el último pedido' }))
    expect(onArrancar).toHaveBeenCalledWith('repetir', expect.objectContaining({ id: 'v2' }))
  })

  it('un cliente sin pedidos: Repetir queda deshabilitado y dice por qué (no hay endpoint de "lo que suele llevar")', async () => {
    servidor({ ventas: [pedido('p', '2026-10-11T15:00:00Z', { tipoOperacion: 1 })] })
    const { onArrancar } = abrir()
    await screen.findByText('Es la primera venta de este cliente: no hay un pedido para repetir.')
    expect(screen.getByRole('button', { name: 'Repetir el último pedido' })).toBeDisabled()
    await userEvent.press(screen.getByRole('button', { name: 'Repetir el último pedido' }))
    expect(onArrancar).not.toHaveBeenCalled()
    expect(screen.queryByText(/suele llevar/i)).toBeNull()
  })

  it('Buscar en el catálogo y Escanear arrancan sin pedido a repetir', async () => {
    servidor()
    const { onArrancar } = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Buscar en el catálogo' }))
    expect(onArrancar).toHaveBeenLastCalledWith('catalogo')
    await userEvent.press(screen.getByRole('button', { name: 'Escanear en la góndola' }))
    expect(onArrancar).toHaveBeenLastCalledWith('escanear')
  })

  it('el tipo de venta se elige acá', async () => {
    servidor()
    const { onTipo } = abrir()
    await userEvent.press(screen.getByRole('radio', { name: 'Presupuesto' }))
    expect(onTipo).toHaveBeenCalledWith('Presupuesto')
  })

  it('crédito disponible solo si el servidor deja ver importes; deuda vencida con su aviso en un pedido', async () => {
    servidor({ socio: { puedeVerSaldo: true, creditoDisponible: 420000, tieneDeudaVencida: true, deudaVencidaAmount: 15000 } })
    abrir()
    expect(await screen.findByLabelText('Crédito disponible: $ 420.000,00')).toBeTruthy()
    expect(screen.getByLabelText('Deuda vencida: $ 15.000,00')).toBeTruthy()
    expect(screen.getByText(/los pedidos nuevos van a quedar por autorizar/)).toBeTruthy()
  })

  it('sin permiso para ver importes no se muestra el crédito; sin deuda dice "Ninguna"', async () => {
    servidor({ socio: { puedeVerSaldo: false, creditoDisponible: 0, tieneDeudaVencida: false } })
    abrir()
    expect(await screen.findByLabelText('Deuda vencida: Ninguna')).toBeTruthy()
    expect(screen.queryByLabelText(/Crédito disponible/)).toBeNull()
  })

  it('un presupuesto no avisa de la deuda: el aviso es de los pedidos', async () => {
    servidor({ socio: { tieneDeudaVencida: true } })
    abrir('Presupuesto')
    await screen.findByLabelText(/Deuda vencida/)
    expect(screen.queryByText(/van a quedar por autorizar/)).toBeNull()
  })

  it('la ficha del cliente y la llamada salen del cliente elegido', async () => {
    servidor()
    abrir()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Llamar' })).toBeTruthy())
    await userEvent.press(screen.getByRole('button', { name: 'Ver ficha del cliente' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/socios/c1')
  })
})

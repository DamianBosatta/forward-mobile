import React from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { SelectorDepositoVenta } from '../components/SelectorDepositoVenta'
import { elegirDepositoDeSesion, limpiarDepositoDeSesion } from '@/features/deposito-sesion'
import { useDepositoAjenoDeVenta, useDepositoDeVenta, useDepositoElegidoStore } from '../hooks/useDepositoDeVenta'

const mockDepositos = jest.fn()
jest.mock('@/libs/api-client', () => ({
  ...jest.requireActual('@/libs/api-client'),
  useDepositos: () => mockDepositos(),
}))

const PROPIO = 'dep-propio'
const OTRO = 'dep-otro'
const activos = [
  { id: PROPIO, nombre: 'Salta', activo: true },
  { id: OTRO, nombre: 'Tucumán', activo: true },
]
const conPermisos = (caps: string[], depositoId?: string) =>
  useAuthStore.setState({ user: { id: 'u', roles: ['Vendedor'], depositoId, permissions: caps.map((module) => ({ module, canRead: true })) } as never })

let qc: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useDepositoElegidoStore.setState({ elegido: null })
  mockDepositos.mockReturnValue({ data: activos })
  conPermisos([], PROPIO)
})

describe('useDepositoDeVenta: la fuente única del depósito de la venta (S18)', () => {
  it('sin elección es el depósito del usuario y no hay depósito ajeno (el catálogo de siempre)', () => {
    const { result } = renderHook(() => ({ d: useDepositoDeVenta(), a: useDepositoAjenoDeVenta() }), { wrapper })
    expect(result.current).toEqual({ d: PROPIO, a: undefined })
  })

  it('sin depósito en el perfil es el Central', () => {
    conPermisos([])
    const { result } = renderHook(() => useDepositoDeVenta(), { wrapper })
    expect(result.current).toBe(DEPOSITO_CENTRAL_ID)
  })

  it('el depósito elegido manda y pasa a ser el ajeno', () => {
    useDepositoElegidoStore.setState({ elegido: OTRO })
    const { result } = renderHook(() => ({ d: useDepositoDeVenta(), a: useDepositoAjenoDeVenta() }), { wrapper })
    expect(result.current).toEqual({ d: OTRO, a: OTRO })
  })

  it('elegir el propio otra vez no cuenta como ajeno', () => {
    useDepositoElegidoStore.setState({ elegido: PROPIO })
    const { result } = renderHook(() => useDepositoAjenoDeVenta(), { wrapper })
    expect(result.current).toBeUndefined()
  })
})

describe.each(['light', 'dark'] as const)('SelectorDepositoVenta (%s)', (scheme) => {
  beforeEach(() => conTema(scheme))
  const montar = () => render(<QueryClientProvider client={qc}><SelectorDepositoVenta /></QueryClientProvider>)

  it('no se muestra sin CAP_VER_TODOS_LOS_DEPOSITOS', () => {
    montar()
    expect(screen.queryByText('Sale del depósito')).toBeNull()
  })

  it('con la capacidad lista los depósitos activos y elegir uno cambia el depósito de la venta', () => {
    conPermisos(['CAP_VER_TODOS_LOS_DEPOSITOS'], PROPIO)
    montar()
    expect(screen.getByText('Sale del depósito')).toBeTruthy()
    fireEvent.press(screen.getByText('Tucumán'))
    expect(useDepositoElegidoStore.getState().elegido).toBe(OTRO)
  })

  it('con un solo depósito activo no hay nada que elegir', () => {
    conPermisos(['CAP_VER_TODOS_LOS_DEPOSITOS'], PROPIO)
    mockDepositos.mockReturnValue({ data: [activos[0], { id: OTRO, nombre: 'Viejo', activo: false }] })
    montar()
    expect(screen.queryByText('Sale del depósito')).toBeNull()
  })
})

describe('la venta arranca en el depósito de la sesión (S8)', () => {
  const SALTA = '11111111-1111-4111-8111-111111111111'
  const NORTE = '22222222-2222-4222-8222-222222222222'
  const GUARDADO = '33333333-3333-4333-8333-333333333333'
  const conCapacidad = () =>
    useAuthStore.setState({ user: { id: 'u', roles: [], depositoId: SALTA, permissions: [{ module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true }] } as never })
  beforeEach(() => {
    conCapacidad()
    elegirDepositoDeSesion('u', NORTE)
    mockDepositos.mockReturnValue({ data: [{ id: SALTA, nombre: 'Salta', activo: true }, { id: NORTE, nombre: 'Zona Norte', activo: true }] })
  })
  afterEach(() => limpiarDepositoDeSesion())

  it('una venta nueva usa el depósito de la sesión; el catálogo lo pide como depósito ajeno al del usuario', () => {
    const { result } = renderHook(() => ({ d: useDepositoDeVenta(), a: useDepositoAjenoDeVenta() }), { wrapper })
    expect(result.current).toEqual({ d: NORTE, a: NORTE })
  })

  it('una venta que se retoma o edita sigue en su depósito guardado aunque la sesión cambie', () => {
    useDepositoElegidoStore.setState({ elegido: GUARDADO })
    const { result } = renderHook(() => useDepositoDeVenta(), { wrapper })
    expect(result.current).toBe(GUARDADO)
    act(() => elegirDepositoDeSesion('u', SALTA))
    expect(result.current).toBe(GUARDADO)
  })

  it('el selector de la venta arranca en el depósito de la sesión y se puede cambiar', () => {
    conTema('light')
    render(<QueryClientProvider client={qc}><SelectorDepositoVenta /></QueryClientProvider>)
    expect(screen.getByRole('button', { name: 'Zona Norte', selected: true })).toBeTruthy()
    fireEvent.press(screen.getByText('Salta'))
    expect(useDepositoElegidoStore.getState().elegido).toBe(SALTA)
  })
})

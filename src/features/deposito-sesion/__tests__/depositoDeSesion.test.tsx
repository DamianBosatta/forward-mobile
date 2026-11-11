import React from 'react'
import { act, render, renderHook, screen, userEvent, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import type { AltaVenta } from '@/features/venta-nueva/lib/payload'

// El disco (MMKV) es un Map compartido: sobrevive a "reiniciar la app" (volver a cargar los módulos).
const mockDisco = new Map<string, string>()
jest.mock('@/core/utils/storage', () => ({
  storage: {
    set: (k: string, v: string) => mockDisco.set(k, v),
    getString: (k: string) => mockDisco.get(k),
    remove: (k: string) => mockDisco.delete(k),
  },
  zustandStorage: { setItem: () => undefined, getItem: () => null, removeItem: () => undefined },
}))
const mockDepositos = jest.fn()
jest.mock('@/libs/api-client/depositos', () => ({ useDepositos: () => mockDepositos() }))

import { useDepositoDeConsulta } from '@/features/catalogo/hooks/useDepositoDeConsulta'
import { DepositoSesion } from '../components/DepositoSesion'
import { useDepositoSesionEfectivo } from '../hooks/useDepositoDeSesion'
import { depositoDeSesionDe, elegirDepositoDeSesion } from '../lib/depositoDeSesion'
import { encolarVenta, leerCola } from '@/features/venta-sin-senal/lib/cola'

const PROPIO = '11111111-1111-4111-8111-111111111111'
const NORTE = '22222222-2222-4222-8222-222222222222'
const SUR = '33333333-3333-4333-8333-333333333333'
const LISTA = [
  { id: PROPIO, nombre: 'Salta', activo: true },
  { id: NORTE, nombre: 'Zona Norte', activo: true },
  { id: SUR, nombre: 'Zona Sur', activo: true },
]
const VE_TODOS = 'CAP_VER_TODOS_LOS_DEPOSITOS'
const usuario = (caps: string[], depositoId: string | null = PROPIO, id = 'u1') =>
  useAuthStore.setState({ user: { id, username: id, roles: [], depositoId, permissions: caps.map((module) => ({ module, canRead: true })) } as never })

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DepositoSesion /></QueryClientProvider>)
}

beforeEach(() => {
  conTema('light')
  mockDisco.clear()
  mockDepositos.mockReturnValue({ data: LISTA, isSuccess: true, isLoading: false, isError: false })
  usuario([VE_TODOS])
})

describe('selector del depósito de la sesión (S8)', () => {
  it('sin CAP_VER_TODOS_LOS_DEPOSITOS no se ve nada', () => {
    usuario([])
    pintar()
    expect(screen.queryByTestId('deposito-sesion')).toBeNull()
  })

  it('con la capacidad muestra el depósito actual (al entrar, el propio) y abre la hoja con los depósitos', async () => {
    pintar()
    expect(screen.getByRole('button', { name: 'Depósito: Salta' })).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Depósito: Salta' }))
    const hoja = within(screen.getByTestId('hoja-depositos'))
    for (const nombre of ['Todos los depósitos', 'Salta', 'Zona Norte', 'Zona Sur']) expect(hoja.getByRole('button', { name: nombre })).toBeTruthy()
    await userEvent.press(hoja.getByRole('button', { name: 'Zona Norte' }))
    expect(screen.getByRole('button', { name: 'Depósito: Zona Norte' })).toBeTruthy()
    expect(depositoDeSesionDe('u1')).toBe(NORTE)
  })

  it('"Todos los depósitos" se recuerda como elección', async () => {
    pintar()
    await userEvent.press(screen.getByRole('button', { name: 'Depósito: Salta' }))
    await userEvent.press(within(screen.getByTestId('hoja-depositos')).getByRole('button', { name: 'Todos los depósitos' }))
    expect(screen.getByRole('button', { name: 'Depósito: Todos los depósitos' })).toBeTruthy()
    expect(depositoDeSesionDe('u1')).toBeNull()
  })

  it('sin la capacidad, una elección vieja se borra', () => {
    elegirDepositoDeSesion('u1', NORTE)
    usuario([])
    pintar()
    expect(depositoDeSesionDe('u1')).toBeUndefined()
  })

  it('un depósito dado de baja deja de filtrar: vuelve a "Todos" (como la web)', () => {
    elegirDepositoDeSesion('u1', SUR)
    mockDepositos.mockReturnValue({ data: LISTA.slice(0, 2), isSuccess: true, isLoading: false, isError: false })
    pintar()
    expect(depositoDeSesionDe('u1')).toBeNull()
  })
})

describe('la elección se guarda en el teléfono', () => {
  it('sobrevive a reiniciar la app (módulos nuevos, mismo disco)', () => {
    elegirDepositoDeSesion('u1', NORTE)
    jest.isolateModules(() => {
      const { depositoDeSesionDe: leerDeNuevo } = require('../lib/depositoDeSesion') as typeof import('../lib/depositoDeSesion')
      expect(leerDeNuevo('u1')).toBe(NORTE)
    })
  })

  it('otro usuario en el mismo teléfono no la hereda', () => {
    elegirDepositoDeSesion('u1', NORTE)
    usuario([VE_TODOS], PROPIO, 'u2')
    const { result } = renderHook(() => useDepositoDeConsulta())
    expect(result.current).toBe(PROPIO)
    pintar()
    // La de u1 se borra y u2 arranca en su propio depósito (como la web).
    expect(depositoDeSesionDe('u1')).toBeUndefined()
    expect(depositoDeSesionDe('u2')).toBe(PROPIO)
  })
})

describe('useDepositoDeConsulta: el depósito de la sesión', () => {
  it('con la capacidad devuelve el depósito elegido y sigue los cambios', () => {
    const { result } = renderHook(() => useDepositoDeConsulta())
    expect(result.current).toBe(PROPIO)
    act(() => elegirDepositoDeSesion('u1', NORTE))
    expect(result.current).toBe(NORTE)
  })

  it('con "Todos" consulta en el Central; para leer listados es null', () => {
    elegirDepositoDeSesion('u1', null)
    const { result } = renderHook(() => ({ consulta: useDepositoDeConsulta(), efectivo: useDepositoSesionEfectivo() }))
    expect(result.current).toEqual({ consulta: DEPOSITO_CENTRAL_ID, efectivo: null })
  })

  it('sin la capacidad es siempre el propio, aunque haya algo guardado', () => {
    elegirDepositoDeSesion('u1', NORTE)
    usuario([])
    const { result } = renderHook(() => ({ consulta: useDepositoDeConsulta(), efectivo: useDepositoSesionEfectivo() }))
    expect(result.current).toEqual({ consulta: PROPIO, efectivo: PROPIO })
  })

  it('sin depósito en el perfil, el Central', () => {
    usuario([], null)
    const { result } = renderHook(() => useDepositoDeConsulta())
    expect(result.current).toBe(DEPOSITO_CENTRAL_ID)
  })
})

describe('ventas guardadas sin señal', () => {
  const alta = (depositoId: string): AltaVenta => ({
    clienteId: 'c1', depositoId, tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false,
    descuentoGeneral: 0, items: [{ productoId: 'p1', cantidad: 6, descuentoPorcentaje: 0 }], claveIdempotencia: 'mobile-k1',
  })

  it('cambiar el depósito de la sesión no reescribe el depósito de una venta en cola', () => {
    encolarVenta('u1', { alta: alta(PROPIO), cliente: {}, visto: { total: 600, precios: { p1: 100 } } })
    elegirDepositoDeSesion('u1', NORTE)
    elegirDepositoDeSesion('u1', null)
    expect(leerCola('u1').map((v) => v.alta.depositoId)).toEqual([PROPIO])
  })
})

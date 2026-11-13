import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import { crearQueryClient } from '@/core/query/queryClient'
import { TEMAS, conTema } from '@/core/ui/fw/__testing__/tema'
import { TarjetaDeudores } from '../components/TarjetaDeudores'
import { DeudoresDeInicio, destinoDeDeudores } from '../components/DeudoresDeInicio'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const NBSP = ' '
const RESUMEN = { clientesConDeuda: 7, totalDeudaClientes: 480000, totalDeudaVencidaClientes: 120000, proveedoresConDeuda: 0, totalDeudaProveedores: 0 }

const conPermisos = (...pares: string[]) =>
  useAuthStore.setState({
    user: {
      id: 'u1', username: 'u', roles: [],
      permissions: pares.map((p) => { const [module, a] = p.split(':'); return { module, canRead: a === 'read', canCreate: a === 'create' } }),
    },
  } as never)
const pintar = (props: React.ComponentProps<typeof DeudoresDeInicio> = {}) =>
  render(<QueryClientProvider client={crearQueryClient({ retry: false })}><DeudoresDeInicio {...props} /></QueryClientProvider>)

afterEach(() => conTema('light'))

describe.each(TEMAS)('TarjetaDeudores: cada estado (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('con datos: clientes, total y lo vencido, y es un botón que lleva a la cartera', async () => {
    const alTocar = jest.fn()
    render(<TarjetaDeudores estado="datos" datos={{ clientes: 7, total: 480000, vencido: 120000 }} onPress={alTocar} />)
    expect(screen.getByText('7 clientes te deben')).toBeTruthy()
    expect(screen.getByTestId('deudores-monto').props.children).toBe(`$${NBSP}480.000,00`)
    expect(screen.getByTestId('deudores-vencido').props.children).toBe(`$${NBSP}120.000,00 vencido hace más de 30 días`)
    await userEvent.press(screen.getByRole('button', { name: /Deudores/ }))
    expect(alTocar).toHaveBeenCalledTimes(1)
  })

  it('1 cliente va en singular y sin la parte vencida no hay esa línea', () => {
    render(<TarjetaDeudores estado="datos" datos={{ clientes: 1, total: 100, vencido: null }} onPress={jest.fn()} />)
    expect(screen.getByText('1 cliente te debe')).toBeTruthy()
    expect(screen.queryByTestId('deudores-vencido')).toBeNull()
  })

  it('sin destino se lee pero no es un botón', () => {
    render(<TarjetaDeudores estado="datos" datos={{ clientes: 2, total: 100, vencido: null }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('tarjeta-deudores')).toBeTruthy()
  })

  it('vacío: sin deudores lo dice', () => {
    render(<TarjetaDeudores estado="datos" datos={{ clientes: 0, total: 0, vencido: null }} />)
    expect(screen.getByText('Sin deudores: ningún cliente tiene deuda abierta.')).toBeTruthy()
  })

  it('cargando: bloque de carga, sin cifras', () => {
    render(<TarjetaDeudores estado="cargando" />)
    expect(screen.getByLabelText('Cargando los deudores')).toBeTruthy()
    expect(screen.queryByTestId('deudores-monto')).toBeNull()
  })

  it('error: lo dice y "Reintentar" vuelve a pedir; nunca una cifra inventada', async () => {
    const reintentar = jest.fn()
    render(<TarjetaDeudores estado="error" onReintentar={reintentar} />)
    expect(screen.getByText('No se pudieron cargar los deudores.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar deudores' }))
    expect(reintentar).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('deudores-monto')).toBeNull()
  })
})

describe('DeudoresDeInicio: adónde lleva y con qué permiso', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockResolvedValue(RESUMEN)
  })

  it('con Clientes, "Ver deudores" abre la solapa Clientes', async () => {
    conPermisos('MOD_PAGOS:read', 'MOD_CLIENTES:read', 'MOD_CC:read')
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: /Deudores/ }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/socios')
  })

  it('sin Clientes pero con Cobros, abre las cuentas corrientes', async () => {
    conPermisos('MOD_PAGOS:read', 'MOD_CC:read')
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: /Deudores/ }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/cuentas')
  })

  it('sin ninguno de los dos no hay adónde ir: la tarjeta se lee pero no es un botón', async () => {
    conPermisos('MOD_PAGOS:read')
    pintar()
    expect(await screen.findByText('7 clientes te deben')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(destinoDeDeudores(() => false)).toBeNull()
  })

  it('sin MOD_PAGOS no pide /deudas/resumen (403) y sin respaldo no dibuja nada', () => {
    conPermisos('MOD_CLIENTES:read')
    pintar()
    expect(screen.queryByTestId('tarjeta-deudores')).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('sin MOD_PAGOS usa el respaldo (cobros pendientes del vendedor), sin parte vencida', () => {
    conPermisos('MOD_VENTAS:read', 'MOD_CLIENTES:read')
    pintar({ respaldo: { cargando: false, error: false, datos: { clientes: 4, total: 640300 }, reintentar: jest.fn() } })
    expect(screen.getByText('4 clientes te deben')).toBeTruthy()
    expect(screen.queryByTestId('deudores-vencido')).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('si /deudas/resumen falla, lo dice con "Reintentar"', async () => {
    conPermisos('MOD_PAGOS:read', 'MOD_CLIENTES:read')
    mockGet.mockRejectedValue(new Error('boom'))
    pintar()
    expect(await screen.findByText('No se pudieron cargar los deudores.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar deudores' })).toBeTruthy()
  })
})

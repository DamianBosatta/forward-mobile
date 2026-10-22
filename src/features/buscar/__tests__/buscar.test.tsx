import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { BuscarScreen } from '../BuscarScreen'
import { clientesConCuenta, seccionesVisibles } from '../lib/secciones'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))

let mockVentaNueva = false
jest.mock('@/features/ventas/lib/ventaNueva', () => ({ ...jest.requireActual('@/features/ventas/lib/ventaNueva'), useVentaNueva: () => mockVentaNueva }))

const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

let mockPermisos: string[] = []
// 'MOD_X' otorga lectura; 'MOD_X:create' otorga esa acción.
const mockCanDo = (modulo: string, accion = 'read') => mockPermisos.includes(accion === 'read' ? modulo : `${modulo}:${accion}`)
jest.mock('@/core/auth/RequirePermission', () => ({
  usePermissions: () => ({ canDo: (m: string, a?: string) => mockCanDo(m, a) }),
}))

const CLIENTE = {
  id: 'c1',
  razonSocial: 'Abel SRL',
  direccion: 'Tarantino 1898',
  nombreFantasia: 'Autoservicio Abel',
  activo: true,
  saldoAmount: 214560,
  puedeVerSaldo: true,
  puedeVerCuentaCorriente: true,
  tieneDeudaVencida: true,
  deudaVencidaAmount: 84300,
}
const VENTA = {
  id: 'v1',
  codigoPedido: 'A00419',
  razonSocialCliente: 'Abel SRL',
  direccionCliente: 'Tarantino 1898',
  fecha: new Date().toISOString(),
  estado: 'EnPreparacion',
  tipoOperacion: 2,
  totalAmount: 88738.89,
}

function paginado(items: unknown[]) {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasNextPage: false }
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><BuscarScreen /></QueryClientProvider>)
}
const urls = () => mockGet.mock.calls.map(([u]) => String(u))

beforeEach(() => {
  jest.clearAllMocks()
  mockPermisos = ['MOD_CLIENTES', 'MOD_VENTAS', 'MOD_CC']
  mockVentaNueva = false
  mockGet.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/Ventas?') ? paginado([VENTA]) : paginado([CLIENTE])))
})

describe('seccionesVisibles / clientesConCuenta', () => {
  it('cada sección aparece solo si el usuario lee su módulo', () => {
    expect(seccionesVisibles((m) => m === 'MOD_CLIENTES')).toEqual({ clientes: true, ventas: false, cuentas: false })
    expect(seccionesVisibles((m) => m === 'MOD_CC')).toEqual({ clientes: false, ventas: false, cuentas: true })
    expect(seccionesVisibles((m) => m === 'MOD_PEDIDOS')).toEqual({ clientes: false, ventas: true, cuentas: false })
  })

  it('el chofer no ve la sección de ventas aunque las lea', () => {
    expect(seccionesVisibles((m, a) => m === 'MOD_VIAJES' || (m === 'MOD_VENTAS' && a === 'read')).ventas).toBe(false)
  })

  it('la cuenta corriente solo lista clientes con cuenta y saldo visibles', () => {
    const a = { ...CLIENTE, id: 'a' }
    const b = { ...CLIENTE, id: 'b', puedeVerCuentaCorriente: false }
    const c = { ...CLIENTE, id: 'c', puedeVerSaldo: false }
    expect(clientesConCuenta([a, b, c] as never).map((x) => x.id)).toEqual(['a'])
  })
})

describe('Buscar', () => {
  it('sin texto no consulta nada', async () => {
    pintar()
    expect(screen.getByText('Escribí al menos 2 letras para buscar.')).toBeTruthy()
    expect(screen.getByText('La búsqueda solo muestra lo que tu usuario puede ver.')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('con permisos de todo muestra clientes, ventas y cuenta corriente, y cada fila abre su pantalla', async () => {
    pintar()
    await userEvent.type(screen.getByLabelText('Buscar'), 'Tarantino')

    const clientes = await screen.findByTestId('buscar-clientes')
    const ventas = await screen.findByTestId('buscar-ventas')
    const cuentas = await screen.findByTestId('buscar-cuentas')
    expect(await within(clientes).findByText('CLIENTES · 1')).toBeTruthy()
    expect(await within(ventas).findByText('Pedido A00419')).toBeTruthy()
    expect(urls().some((u) => u.startsWith('/api/v1/socios-comerciales') && u.includes('searchTerm=Tarantino'))).toBe(true)
    expect(urls().some((u) => u.startsWith('/api/v1/Ventas?') && u.includes('searchTerm=Tarantino'))).toBe(true)

    expect(within(clientes).getByText('CLIENTES · 1')).toBeTruthy()
    await userEvent.press(within(clientes).getByRole('button', { name: 'Tarantino 1898, Autoservicio Abel' }))
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'c1' } })

    expect(within(ventas).getByText('Pedido A00419')).toBeTruthy()
    // El chip sale del estado por nombre (X11).
    expect(within(ventas).getByLabelText('Estado: En preparación')).toBeTruthy()
    await userEvent.press(within(ventas).getByRole('button', { name: /Pedido A00419/ }))
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/ventas/v1')

    expect(within(cuentas).getByText('$ 214.560,00')).toBeTruthy()
    expect(within(cuentas).getByText('Vencido $ 84.300,00')).toBeTruthy()
    await userEvent.press(within(cuentas).getByRole('button', { name: /Cuenta de Tarantino 1898/ }))
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(tabs)/cuentas/[id]', params: { id: 'c1' } })
  })

  describe('Vender al cliente encontrado (T4c, lienzo ResBuscar)', () => {
    it('con la venta nueva prendida y permiso para crear, la fila del cliente ofrece Vender con ese cliente', async () => {
      mockVentaNueva = true
      mockPermisos = ['MOD_CLIENTES', 'MOD_VENTAS', 'MOD_VENTAS:create']
      pintar()
      await userEvent.type(screen.getByLabelText('Buscar'), 'Tarantino')
      const clientes = await screen.findByTestId('buscar-clientes')
      await userEvent.press(await within(clientes).findByRole('button', { name: 'Vender a Tarantino 1898' }))
      expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/ventas/nueva-v2?clienteId=c1')
    })

    it.each([
      ['con el switch apagado', false, ['MOD_CLIENTES', 'MOD_VENTAS', 'MOD_VENTAS:create']],
      ['sin permiso para crear ventas', true, ['MOD_CLIENTES', 'MOD_VENTAS']],
    ])('%s no hay Vender y la fila sigue abriendo la ficha', async (_n, switchPrendido, permisos) => {
      mockVentaNueva = switchPrendido
      mockPermisos = permisos
      pintar()
      await userEvent.type(screen.getByLabelText('Buscar'), 'Tarantino')
      const clientes = await screen.findByTestId('buscar-clientes')
      await within(clientes).findByText('CLIENTES · 1')
      expect(within(clientes).queryByRole('button', { name: /^Vender/ })).toBeNull()
      await userEvent.press(within(clientes).getByRole('button', { name: 'Tarantino 1898, Autoservicio Abel' }))
      expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'c1' } })
    })
  })

  it('sin Cuentas corrientes esa sección no aparece ni se consulta', async () => {
    mockPermisos = ['MOD_CLIENTES', 'MOD_VENTAS']
    pintar()
    await userEvent.type(screen.getByLabelText('Buscar'), 'Tarantino')

    expect(await screen.findByTestId('buscar-clientes')).toBeTruthy()
    expect(screen.queryByTestId('buscar-cuentas')).toBeNull()
  })

  it('solo con Cuentas corrientes no muestra clientes ni ventas', async () => {
    mockPermisos = ['MOD_CC']
    pintar()
    await userEvent.type(screen.getByLabelText('Buscar'), 'Tarantino')

    expect(await screen.findByTestId('buscar-cuentas')).toBeTruthy()
    expect(screen.queryByTestId('buscar-clientes')).toBeNull()
    expect(screen.queryByTestId('buscar-ventas')).toBeNull()
    expect(urls().some((u) => u.startsWith('/api/v1/Ventas?'))).toBe(false)
  })

  it('sin ningún módulo avisa y no consulta', async () => {
    mockPermisos = []
    pintar()
    expect(screen.getByText('Tu usuario no tiene acceso a ningún módulo para buscar.')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('sin coincidencias lo dice por sección', async () => {
    mockGet.mockImplementation(() => Promise.resolve(paginado([])))
    pintar()
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzz')

    const ventas = await screen.findByTestId('buscar-ventas')
    expect(await within(ventas).findByText('Sin resultados.')).toBeTruthy()
  })

  it('el botón de atrás vuelve', async () => {
    pintar()
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(mockBack).toHaveBeenCalled()
  })
})

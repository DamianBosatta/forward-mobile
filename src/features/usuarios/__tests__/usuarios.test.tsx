/**
 * Mobile redesign, stage 4 (lámina perfil--usuarios, decisión L8 del dueño): lista de usuarios de
 * solo consulta, "igual que la web": MOD_USUARIOS:Read y el endpoint existente, sin permiso nuevo.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import UsuariosRoute from '../../../../app/(tabs)/perfil/usuarios'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: (url: string) => mockGet(url), post: jest.fn() } }))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }))
jest.mock('expo-router/react-navigation', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

const FILAS = [
  { id: 'u0', nombre: 'Marcelo', apellido: 'Bianchi', nombreCompleto: 'Marcelo Bianchi', puestoNombre: 'Dueño', roles: ['Administrador'], estaActivo: true },
  { id: 'u1', nombre: 'Lucía', apellido: 'Fernández', nombreCompleto: 'Lucía Fernández', puestoNombre: 'Vendedora', roles: ['Empleado'], estaActivo: true },
  { id: 'u2', nombre: 'Darío', apellido: 'Giménez', nombreCompleto: 'Darío Giménez', puestoNombre: 'Chofer', roles: ['Empleado'], estaActivo: false },
]
const pagina = (items: object[]) => ({ items, page: 1, pageSize: 50, totalCount: 12, totalPages: 1, hasNextPage: false })

function entrar(permissions: object[]) {
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1', username: 'lucia', roles: ['Empleado'], permissions } } as never)
}
const conLectura = () => entrar([{ module: 'MOD_USUARIOS', canRead: true }])

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><UsuariosRoute /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue(pagina(FILAS))
})

describe('Usuarios (solo consulta)', () => {
  it('sin MOD_USUARIOS:Read no se ve la lista ni se pide al servidor', async () => {
    entrar([{ module: 'MOD_VENTAS', canRead: true }])
    pintar()
    expect(await screen.findByText(/No tenés acceso a Usuarios/)).toBeTruthy()
    expect(screen.queryByText('Marcelo Bianchi')).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('con permiso, lista cada usuario con su puesto y su estado y dice cuántos son', async () => {
    conLectura()
    pintar()
    expect(await screen.findByText('Marcelo Bianchi')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/v1\/Users\?/))
    expect(screen.getByText('Dueño')).toBeTruthy()
    expect(screen.getByText('Chofer')).toBeTruthy()
    expect(screen.getByText('12 usuarios')).toBeTruthy()
    expect(screen.getAllByLabelText('Estado: Activo')).toHaveLength(2)
    expect(screen.getAllByLabelText('Estado: Inactivo')).toHaveLength(1)
  })

  it('marca con "· vos" al usuario de la sesión', async () => {
    conLectura()
    pintar()
    expect(await screen.findByText('Lucía Fernández · vos')).toBeTruthy()
  })

  it('es de solo consulta: avisa que se maneja desde la web y no ofrece alta, edición ni baja', async () => {
    conLectura()
    pintar()
    await screen.findByText('Marcelo Bianchi')
    expect(screen.getByText('Solo consulta. Altas, bajas y permisos se manejan desde la web.')).toBeTruthy()
    // El único botón es "Volver": ninguna fila ni acción se puede tocar.
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Volver'])
    expect(screen.queryByText(/Nuevo|Editar|Bloquear|Desactivar/)).toBeNull()
  })

  it('buscar por nombre o puesto lo pide al servidor con el mismo endpoint', async () => {
    conLectura()
    pintar()
    await screen.findByText('Marcelo Bianchi')
    await userEvent.type(screen.getByLabelText('Buscar por nombre o puesto'), 'chofer')
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('searchTerm=chofer')))
  })

  it('sin conexión muestra el estado de siempre con Reintentar', async () => {
    conLectura()
    mockGet.mockRejectedValue(new TypeError('Network request failed'))
    pintar()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})

describe('Usuarios como clientes (propuesta Cuenta, frames 6 y 7)', () => {
  it('las filas con iniciales van en una tarjeta sin borde', async () => {
    conLectura()
    pintar()
    const tarjeta = await screen.findByTestId('tarjeta-usuarios')
    expect(within(tarjeta).getByText('MB')).toBeTruthy()
    expect(within(tarjeta).getByText('Marcelo Bianchi')).toBeTruthy()
    expect(StyleSheet.flatten(tarjeta.props.style).borderWidth ?? 0).toBe(0)
  })

  it('el buscador es el grande de la lista de clientes', async () => {
    conLectura()
    pintar()
    await screen.findByText('Marcelo Bianchi')
    expect(StyleSheet.flatten(screen.getByTestId('buscador-cartera').props.style).height).toBe(52)
    expect(screen.getByLabelText('Buscar por nombre o puesto')).toBeTruthy()
  })

  it('mientras carga muestra esqueletos de fila', async () => {
    conLectura()
    mockGet.mockReturnValue(new Promise(() => {}))
    pintar()
    expect(await screen.findByLabelText('Cargando')).toBeTruthy()
    expect(screen.getAllByTestId('esqueleto-fila').length).toBeGreaterThan(0)
  })
})

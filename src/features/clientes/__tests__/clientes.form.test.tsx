import React from 'react'
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import ClienteFormScreen from '../../../../app/(tabs)/socios/nuevo'
import { AVISO_CONDICION_PAGO } from '../components/FichaCliente'
import { api } from '@/core/api/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { sociosKeys } from '@/libs/api-client/socios'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { clienteDeLista, conPermisos, renderConQuery } from '../__testing__/ayuda'
import { CUIT_INVALIDO, CUIT_REQUERIDO } from '@/features/socios/lib/cuit'

const mockReplace = jest.fn()
let mockId: string | undefined
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({ id: mockId }),
}))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, API_URL: '' }))

const post = api.post as jest.Mock
const put = api.put as jest.Mock
const SIN_CAP = [{ module: 'MOD_CLIENTES', canRead: true, canCreate: true, canUpdate: true }]
const CON_CAP = [...SIN_CAP, { module: 'CAP_AUTORIZAR_VENTA', canRead: true }]
const CUIT_OK = '30-70999888-5'

async function completarAlta({ cuit = CUIT_OK }: { cuit?: string } = {}) {
  fireEvent.changeText(screen.getByLabelText('CUIT'), cuit)
  fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
  fireEvent.changeText(screen.getByLabelText('Nombre del local'), 'Kiosco Chela')
  fireEvent.changeText(screen.getByLabelText('Contacto'), 'Chela')
  fireEvent.changeText(screen.getByLabelText('Teléfono'), '1146582291')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockId = undefined
  post.mockResolvedValue('nuevo-id')
  put.mockResolvedValue(true)
})

it('sin la capacidad de autorizar ventas, la condición de pago es de solo lectura y no se manda', async () => {
  conPermisos(SIN_CAP)
  renderConQuery(<ClienteFormScreen />)

  expect(screen.getByText(AVISO_CONDICION_PAGO)).toBeTruthy()
  expect(screen.queryByRole('radio', { name: 'Días desde la entrega' })).toBeNull()
  await completarAlta()
  await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  const body = post.mock.calls[0][1]
  expect(body).toMatchObject({ tipoRaw: 0, direccion: 'Av. del Valle 89', nombreFantasia: 'Kiosco Chela', nombreContacto: 'Chela' })
  expect(body.condicionPago).toBeUndefined()
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/[id]', params: { id: 'nuevo-id' } })
})

it('con la capacidad, la condición de pago se elige y viaja al servidor', async () => {
  conPermisos(CON_CAP)
  renderConQuery(<ClienteFormScreen />)

  await completarAlta()
  await userEvent.press(screen.getByRole('radio', { name: 'Días desde la entrega' }))
  fireEvent.changeText(screen.getByLabelText('Días'), '15')
  await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  expect(post.mock.calls[0][1].condicionPago).toEqual({ tipo: 'DiasDesdeEntrega', dias: 15 })
})

it('si el servidor rechaza, se ve su mensaje con el detalle', async () => {
  conPermisos(SIN_CAP)
  post.mockRejectedValue(Object.assign(new Error('Datos inválidos.'), { errors: ['El teléfono es obligatorio en clientes.'] }))
  renderConQuery(<ClienteFormScreen />)

  await completarAlta()
  await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

  expect(await screen.findByText('Datos inválidos.\nEl teléfono es obligatorio en clientes.')).toBeTruthy()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('al editar, carga los datos y devuelve el horario que no se edita acá', async () => {
  conPermisos(SIN_CAP)
  mockId = 'c1'
  const horario = [{ dia: 1, desde: '08:00', hasta: '12:00', esValida: true }]
  ;(api.get as jest.Mock).mockResolvedValue({ ...clienteDeLista(), horario, condicionesDeCompraFaltantes: [] })
  renderConQuery(<ClienteFormScreen />)

  await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
  await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => expect(put).toHaveBeenCalled())
  expect(put.mock.calls[0][0]).toBe('/api/v1/socios-comerciales/c1')
  expect(put.mock.calls[0][1]).toMatchObject({ id: 'c1', nombreContacto: 'Chela', horario })
})

describe('edición: el detalle manda', () => {
  const detalle = (extra = {}) => ({ ...clienteDeLista(), horario: [], condicionesDeCompraFaltantes: [], ...extra })
  const conCliente = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={qc}><ClienteFormScreen /></QueryClientProvider>)
    return qc
  }

  it('si el detalle no carga, muestra el error con Reintentar y no deja guardar en blanco', async () => {
    conPermisos(SIN_CAP)
    mockId = 'c1'
    ;(api.get as jest.Mock).mockRejectedValue(new Error('No tenés acceso a este cliente.'))
    renderConQuery(<ClienteFormScreen />)

    expect(await screen.findByText('No tenés acceso a este cliente.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
    expect(put).not.toHaveBeenCalled()

    ;(api.get as jest.Mock).mockResolvedValue(detalle())
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
  })

  it('un refetch posterior no pisa lo que el usuario tipeó', async () => {
    conPermisos(SIN_CAP)
    mockId = 'c1'
    ;(api.get as jest.Mock).mockResolvedValue(detalle())
    const qc = conCliente()
    await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))

    fireEvent.changeText(screen.getByLabelText('Nombre del local'), 'Mi cambio')
    ;(api.get as jest.Mock).mockResolvedValue(detalle({ nombreFantasia: 'Otro del servidor' }))
    await act(async () => { await qc.invalidateQueries({ queryKey: sociosKeys.all }) })
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(screen.getByLabelText('Nombre del local').props.value).toBe('Mi cambio')
  })

  it('al guardar manda el horario recién traído, no el del caché viejo', async () => {
    conPermisos(SIN_CAP)
    mockId = 'c1'
    const viejo = [{ dia: 1, desde: '08:00', hasta: '12:00', esValida: true }]
    const nuevo = [{ dia: 2, desde: '09:00', hasta: '13:00', esValida: true }]
    ;(api.get as jest.Mock).mockResolvedValue(detalle({ horario: nuevo, nombreFantasia: 'Fresco' }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    qc.setQueryData(sociosKeys.detail('c1'), detalle({ horario: viejo, nombreFantasia: 'Viejo' }))
    render(<QueryClientProvider client={qc}><ClienteFormScreen /></QueryClientProvider>)

    await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Fresco'))
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][1].horario).toEqual(nuevo)
  })

  it('con detalle en caché y el refetch fallido, muestra el error con Reintentar y no deja guardar el viejo', async () => {
    conPermisos(SIN_CAP)
    mockId = 'c1'
    ;(api.get as jest.Mock).mockRejectedValue(new Error('Sin conexión.'))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    qc.setQueryData(sociosKeys.detail('c1'), detalle({ nombreFantasia: 'Viejo' }))
    render(<QueryClientProvider client={qc}><ClienteFormScreen /></QueryClientProvider>)

    expect(await screen.findByText('Sin conexión.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
    expect(screen.queryByLabelText('Nombre del local')).toBeNull()
    expect(put).not.toHaveBeenCalled()
  })
})

describe('D7: dirección, razón social y CUIT solo los cambia un administrador (regla de la web)', () => {
  const AVISO = 'La dirección, la razón social y el CUIT los cambia un administrador: pedilo con «Pedir cambio» en la ficha del cliente.'
  const comoRol = (roles: string[]) =>
    useAuthStore.setState({ user: { id: 'u1', username: 'x', email: 'x@x.com', roles, permissions: SIN_CAP } as never })
  const editable = (label: string) => screen.getByLabelText(label).props.editable !== false

  beforeEach(() => {
    mockId = 'c1'
    ;(api.get as jest.Mock).mockResolvedValue({ ...clienteDeLista(), horario: [], condicionesDeCompraFaltantes: [] })
  })

  it('un no administrador edita el resto pero no los tres campos sensibles, y se le dice por qué', async () => {
    comoRol(['Empleado'])
    renderConQuery(<ClienteFormScreen />)

    await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
    expect(editable('Dirección de entrega')).toBe(false)
    expect(editable('CUIT')).toBe(false)
    expect(editable('Razón social')).toBe(false)
    expect(editable('Nombre del local')).toBe(true)
    expect(editable('Teléfono')).toBe(true)
    expect(screen.getByText(AVISO)).toBeTruthy()
  })

  it('un administrador edita todo y no ve el aviso', async () => {
    comoRol(['Administrador'])
    renderConQuery(<ClienteFormScreen />)

    await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
    expect(editable('Dirección de entrega')).toBe(true)
    expect(editable('CUIT')).toBe(true)
    expect(editable('Razón social')).toBe(true)
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('en el alta nadie tiene nada bloqueado', async () => {
    mockId = undefined
    comoRol(['Empleado'])
    renderConQuery(<ClienteFormScreen />)

    expect(editable('Dirección de entrega')).toBe(true)
    expect(editable('CUIT')).toBe(true)
    expect(editable('Razón social')).toBe(true)
    expect(screen.queryByText(AVISO)).toBeNull()
  })
})

describe('L-35: el CUIT del cliente con la regla de la web (buildSocioSchema)', () => {
  beforeEach(() => conPermisos(SIN_CAP))

  it('un alta que no es provisoria sin CUIT no se manda y pide el CUIT', async () => {
    renderConQuery(<ClienteFormScreen />)

    await completarAlta({ cuit: '' })
    await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

    expect(await screen.findByText(CUIT_REQUERIDO)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('un CUIT con el dígito verificador mal no se manda', async () => {
    renderConQuery(<ClienteFormScreen />)

    await completarAlta({ cuit: '30-70999888-1' })
    await userEvent.press(screen.getByRole('button', { name: 'Crear cliente' }))

    expect(await screen.findByText(CUIT_INVALIDO)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })
})

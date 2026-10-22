import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import ProveedorFormScreen from '../../../../app/(tabs)/proveedores/nuevo'
import { api } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { clienteDeLista, conPermisos, renderConQuery } from '../../clientes/__testing__/ayuda'

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
const PERMISOS = [{ module: 'MOD_PROVEEDORES', canRead: true, canCreate: true, canUpdate: true }]
const CUIT_OK = '30-70999888-5'

function completarAlta(extra: { cuit?: string; razon?: string } = {}) {
  fireEvent.changeText(screen.getByLabelText('Razón social'), extra.razon ?? 'Limpieza Norte SRL')
  fireEvent.changeText(screen.getByLabelText('CUIT'), extra.cuit ?? CUIT_OK)
  fireEvent.changeText(screen.getByLabelText('Teléfono'), '1145550000')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockId = undefined
  conPermisos(PERMISOS)
  post.mockResolvedValue('nuevo-id')
  put.mockResolvedValue(true)
})

it('el alta manda un proveedor (tipoRaw 1) con su condición de pago y abre su ficha', async () => {
  renderConQuery(<ProveedorFormScreen />)

  completarAlta()
  await userEvent.press(screen.getByRole('radio', { name: 'Días desde la factura' }))
  fireEvent.changeText(screen.getByLabelText('Días'), '30')
  await userEvent.press(screen.getByRole('button', { name: 'Guardar proveedor' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  expect(post.mock.calls[0][0]).toBe('/api/v1/socios-comerciales')
  const body = post.mock.calls[0][1]
  expect(body).toMatchObject({ tipoRaw: 1, razonSocial: 'Limpieza Norte SRL', cuit: CUIT_OK, telefono: '1145550000', condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 } })
  expect(body.altaProvisoria).toBeUndefined()
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/proveedores/[id]', params: { id: 'nuevo-id' } })
})

it('Contado no pide días y viaja como Contado', async () => {
  renderConQuery(<ProveedorFormScreen />)

  completarAlta()
  await userEvent.press(screen.getByRole('button', { name: 'Guardar proveedor' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  expect(post.mock.calls[0][1].condicionPago).toEqual({ tipo: 'Contado' })
})

it('una razón social de menos de 3 letras no se manda', async () => {
  renderConQuery(<ProveedorFormScreen />)

  completarAlta({ razon: 'Ab' })
  await userEvent.press(screen.getByRole('button', { name: 'Guardar proveedor' }))

  expect(await screen.findByText('La razón social necesita al menos 3 caracteres.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()
})

it('un CUIT con dígito verificador inválido no se manda', async () => {
  renderConQuery(<ProveedorFormScreen />)

  completarAlta({ cuit: '30-70999888-1' })
  await userEvent.press(screen.getByRole('button', { name: 'Guardar proveedor' }))

  expect(await screen.findByText('El CUIT no es válido: revisá los números.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()
})

it('una condición con plazo sin días no se manda', async () => {
  renderConQuery(<ProveedorFormScreen />)

  completarAlta()
  await userEvent.press(screen.getByRole('radio', { name: 'Días desde la entrega' }))
  await userEvent.press(screen.getByRole('button', { name: 'Guardar proveedor' }))

  expect(await screen.findByText('Indicá los días de la condición de pago.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()
})

it('si el servidor rechaza, se ve su mensaje con el detalle y no navega', async () => {
  post.mockRejectedValue(Object.assign(new Error('Datos inválidos.'), { errors: ['Ya existe un socio con ese CUIT.'] }))
  renderConQuery(<ProveedorFormScreen />)

  completarAlta()
  await userEvent.press(screen.getByRole('button', { name: 'Guardar proveedor' }))

  expect(await screen.findByText('Datos inválidos.\nYa existe un socio con ese CUIT.')).toBeTruthy()
  expect(mockReplace).not.toHaveBeenCalled()
})

describe('edición', () => {
  const franja = [{ dia: 1, desde: '08:00', hasta: '12:00', esValida: true }]
  const detalle = (extra = {}) => ({
    ...clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: CUIT_OK, tipo: 'Proveedor', direccion: 'Ruta 2 km 40', nombreFantasia: 'Insumos', nombreContacto: 'Marta', email: 'm@x.com', telefono: '1145550000' }),
    horario: [], franjaEntrega: franja, condicionesDeCompraFaltantes: [], condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 },
    ...extra,
  })
  const comoRol = (roles: string[]) =>
    useAuthStore.setState({ user: { id: 'u1', username: 'x', email: 'x@x.com', roles, permissions: PERMISOS } as never })
  const editable = (label: string) => screen.getByLabelText(label).props.editable !== false

  beforeEach(() => {
    mockId = 'p1'
    ;(api.get as jest.Mock).mockResolvedValue(detalle())
  })

  it('carga los datos y devuelve lo que la pantalla no edita (franja de entrega, dirección, contacto, email)', async () => {
    renderConQuery(<ProveedorFormScreen />)

    await waitFor(() => expect(screen.getByLabelText('Razón social').props.value).toBe('Insumos del Sur SA'))
    expect(screen.getByLabelText('Días').props.value).toBe('30')
    fireEvent.changeText(screen.getByLabelText('Teléfono'), '1199990000')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][0]).toBe('/api/v1/socios-comerciales/p1')
    expect(put.mock.calls[0][1]).toMatchObject({
      id: 'p1', telefono: '1199990000', franjaEntrega: franja, direccion: 'Ruta 2 km 40', nombreContacto: 'Marta', email: 'm@x.com',
      condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 },
    })
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(tabs)/proveedores/[id]', params: { id: 'p1' } })
  })

  it('un no administrador no edita razón social ni CUIT, y se le dice por qué', async () => {
    comoRol(['Empleado'])
    renderConQuery(<ProveedorFormScreen />)

    await waitFor(() => expect(screen.getByLabelText('Teléfono').props.value).toBe('1145550000'))
    expect(editable('Razón social')).toBe(false)
    expect(editable('CUIT')).toBe(false)
    expect(editable('Teléfono')).toBe(true)
    expect(screen.getByText('La razón social y el CUIT los cambia un administrador: pedilo con «Pedir cambio» en la ficha del proveedor.')).toBeTruthy()
  })

  it('un administrador edita todo', async () => {
    comoRol(['Administrador'])
    renderConQuery(<ProveedorFormScreen />)

    await waitFor(() => expect(screen.getByLabelText('Teléfono').props.value).toBe('1145550000'))
    expect(editable('Razón social')).toBe(true)
    expect(editable('CUIT')).toBe(true)
  })

  it('en el alta nadie tiene nada bloqueado', async () => {
    mockId = undefined
    comoRol(['Empleado'])
    renderConQuery(<ProveedorFormScreen />)

    expect(editable('Razón social')).toBe(true)
    expect(editable('CUIT')).toBe(true)
  })

  it('si el detalle no carga, muestra el error con Reintentar y no deja guardar en blanco', async () => {
    ;(api.get as jest.Mock).mockRejectedValue(new Error('No tenés acceso a este proveedor.'))
    renderConQuery(<ProveedorFormScreen />)

    expect(await screen.findByText('No tenés acceso a este proveedor.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
  })
})

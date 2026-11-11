import React from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import ProveedorFormScreen from '../../../../app/(tabs)/proveedores/nuevo'
import { AVISO_CAMPOS_SENSIBLES_PROVEEDOR } from '../lib/proveedor'
import { api } from '@/core/api/client'
import { themeColors } from '@/libs/theme'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { clienteDeLista, conPermisos, renderConQuery } from '../../clientes/__testing__/ayuda'

let mockId: string | undefined
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
}))
jest.mock('expo-router/react-navigation', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, API_URL: '' }))

/** S9: el formulario de proveedor con el mismo estilo que el de cliente (propuesta "Clientes como venta", frames 15 a 20). */
const get = api.get as jest.Mock
const post = api.post as jest.Mock
const put = api.put as jest.Mock
const PERMISOS = [{ module: 'MOD_PROVEEDORES', canRead: true, canCreate: true, canUpdate: true }]
const CUIT_OK = '30-70999888-5'
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>
const comoRol = (roles: string[]) => useAuthStore.setState({ user: { id: 'u1', username: 'x', email: 'x@x.com', roles, permissions: PERMISOS } as never })
const franja = [{ dia: 1, desde: '08:00', hasta: '12:00', esValida: true }]
const detalle = () => ({
  ...clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: CUIT_OK, tipo: 'Proveedor', condicionIva: 'Responsable Inscripto', direccion: 'Ruta 2 km 40', nombreFantasia: 'Insumos', nombreContacto: 'Marta', email: 'm@x.com', telefono: '1145550000' }),
  horario: [], franjaEntrega: franja, condicionesDeCompraFaltantes: [], condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockId = undefined
  conPermisos(PERMISOS)
  post.mockResolvedValue('nuevo-id')
  put.mockResolvedValue(true)
})

it('cada grupo va en una tarjeta sin borde con su título', () => {
  renderConQuery(<ProveedorFormScreen />)

  for (const grupo of ['Datos fiscales', 'Contacto', 'Condiciones de compra']) {
    const tarjeta = screen.getByTestId(`grupo-${grupo}`)
    expect(estilo(tarjeta)).toMatchObject({ backgroundColor: themeColors.light.surface, borderRadius: 16 })
    expect(estilo(tarjeta).borderWidth ?? 0).toBe(0)
    expect(within(tarjeta).getByRole('header', { name: grupo })).toBeTruthy()
  }
})

it('la condición frente al IVA y la de pago son filas con radio dentro de una tarjeta', async () => {
  renderConQuery(<ProveedorFormScreen />)

  for (const [grupo, opcion] of [['Condición frente al IVA', 'Monotributista'], ['Condición de pago (obligatoria para comprarle)', 'Día fijo del mes']]) {
    const radios = screen.getByLabelText(grupo)
    await userEvent.press(within(radios).getByRole('radio', { name: opcion }))
    const elegido = within(radios).getByRole('radio', { name: opcion })
    expect(estilo(elegido).backgroundColor).toBe(themeColors.light.brandSoft)
    expect(within(elegido).getByTestId('marca-radio-elegida')).toBeTruthy()
  }
})

it('el alta manda el mismo cuerpo de hoy, campo por campo', async () => {
  renderConQuery(<ProveedorFormScreen />)

  fireEvent.changeText(screen.getByLabelText('Razón social'), '  Limpieza Norte SRL ')
  fireEvent.changeText(screen.getByLabelText('CUIT'), CUIT_OK)
  fireEvent.changeText(screen.getByLabelText('Teléfono'), '1145550000')
  await userEvent.press(screen.getByRole('radio', { name: 'Monotributista' }))
  await userEvent.press(screen.getByRole('radio', { name: 'Días desde la factura' }))
  fireEvent.changeText(screen.getByLabelText('Días'), '30')
  await userEvent.press(screen.getByRole('button', { name: 'Guardar proveedor' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  expect(post.mock.calls[0][0]).toBe('/api/v1/socios-comerciales')
  expect(post.mock.calls[0][1]).toStrictEqual({
    razonSocial: 'Limpieza Norte SRL',
    cuit: CUIT_OK,
    condicionIva: 'Monotributista',
    telefono: '1145550000',
    condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 },
    direccion: '',
    nombreFantasia: '',
    nombreContacto: '',
    email: '',
    horario: undefined,
    franjaEntrega: undefined,
    tipoRaw: 1,
    saldoInicial: 0,
  })
})

describe('editar como no administrador (frame 19)', () => {
  beforeEach(() => {
    mockId = 'p1'
    get.mockResolvedValue(detalle())
  })

  it('razón social y CUIT pasan a filas bloqueadas en una tarjeta propia, con el aviso', async () => {
    comoRol(['Empleado'])
    renderConQuery(<ProveedorFormScreen />)

    const tarjeta = await screen.findByTestId('campos-bloqueados')
    expect(within(tarjeta).getByText(AVISO_CAMPOS_SENSIBLES_PROVEEDOR)).toBeTruthy()
    expect(within(tarjeta).getByLabelText(`CUIT: ${CUIT_OK}`)).toBeTruthy()
    expect(within(tarjeta).getByLabelText('Razón social: Insumos del Sur SA')).toBeTruthy()
    expect(screen.queryByLabelText('Razón social')).toBeNull()
    expect(screen.queryByLabelText('CUIT')).toBeNull()
    expect(screen.getByLabelText('Teléfono').props.editable).not.toBe(false)
  })

  it('la edición manda el mismo cuerpo de hoy, con razón social y CUIT bloqueados tal como estaban', async () => {
    comoRol(['Empleado'])
    renderConQuery(<ProveedorFormScreen />)

    await waitFor(() => expect(screen.getByLabelText('Teléfono').props.value).toBe('1145550000'))
    fireEvent.changeText(screen.getByLabelText('Teléfono'), '1199990000')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][0]).toBe('/api/v1/socios-comerciales/p1')
    expect(put.mock.calls[0][1]).toStrictEqual({
      razonSocial: 'Insumos del Sur SA',
      cuit: CUIT_OK,
      condicionIva: 'Responsable Inscripto',
      telefono: '1199990000',
      condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 },
      direccion: 'Ruta 2 km 40',
      nombreFantasia: 'Insumos',
      nombreContacto: 'Marta',
      email: 'm@x.com',
      horario: [],
      franjaEntrega: franja,
      id: 'p1',
    })
  })

  it('mientras carga se ven esqueletos con la forma de las tarjetas, no la ruedita', async () => {
    get.mockImplementation(() => new Promise(() => {}))
    renderConQuery(<ProveedorFormScreen />)

    expect(await screen.findByTestId('esqueleto-tarjeta')).toBeTruthy()
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
    expect(screen.queryByLabelText('Teléfono')).toBeNull()
  })
})

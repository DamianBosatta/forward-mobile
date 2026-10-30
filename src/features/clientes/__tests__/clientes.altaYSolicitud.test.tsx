import React from 'react'
import { Linking } from 'react-native'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import ClienteFormScreen from '../../../../app/(tabs)/socios/nuevo'
import { FichaCliente } from '../components/FichaCliente'
import { SOLICITUD_ENVIADA } from '../components/SolicitudCambio'
import { api } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

let mockId: string | undefined
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
}))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const put = api.put as jest.Mock
const SIN_CAP = [{ module: 'MOD_CLIENTES', canRead: true, canCreate: true, canUpdate: true }]
const CON_CAP = [...SIN_CAP, { module: 'CAP_AUTORIZAR_VENTA', canRead: true }]
const detalle = (extra = {}) => ({ ...clienteDeLista(), horario: [], condicionesDeCompraFaltantes: [], topeCredito: 300000, ...extra })

async function completarAlta() {
  fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
  fireEvent.changeText(screen.getByLabelText('Nombre del local'), 'Kiosco Chela')
  fireEvent.changeText(screen.getByLabelText('Contacto'), 'Chela')
  fireEvent.changeText(screen.getByLabelText('Teléfono'), '1146582291')
}
const cuerpoAlta = () => post.mock.calls[0][1]

beforeEach(() => {
  jest.clearAllMocks()
  mockId = undefined
  post.mockResolvedValue('nuevo-id')
  put.mockResolvedValue(true)
})

describe('alta provisoria', () => {
  it('marcada, el alta va como provisoria (el servidor perdona el CUIT y los datos que falten)', async () => {
    conPermisos(SIN_CAP)
    renderConQuery(<ClienteFormScreen />)
    fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
    await userEvent.press(screen.getByRole('checkbox', { name: 'Alta provisoria' }))
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(cuerpoAlta()).toMatchObject({ tipoRaw: 0, altaProvisoria: true, direccion: 'Av. del Valle 89' })
  })

  it('sin marcar, el alta es completa como siempre', async () => {
    conPermisos(SIN_CAP)
    renderConQuery(<ClienteFormScreen />)
    await completarAlta()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(cuerpoAlta().altaProvisoria).toBe(false)
  })

  it('al editar no se ofrece: un cliente existente no vuelve a ser provisorio', async () => {
    conPermisos(SIN_CAP)
    mockId = 'c1'
    get.mockResolvedValue(detalle())
    renderConQuery(<ClienteFormScreen />)

    await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
    expect(screen.queryByRole('checkbox', { name: 'Alta provisoria' })).toBeNull()
  })
})

describe('tope de crédito', () => {
  it('con la capacidad de autorizar ventas, el tope del alta viaja al servidor', async () => {
    conPermisos(CON_CAP)
    renderConQuery(<ClienteFormScreen />)
    await completarAlta()
    fireEvent.changeText(screen.getByLabelText('Tope de crédito'), '250.000')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(cuerpoAlta().topeCredito).toEqual({ monto: 250000 })
  })

  it('sin la capacidad no se ve ni se manda (el servidor solo deja fijarlo a quien autoriza ventas)', async () => {
    conPermisos(SIN_CAP)
    renderConQuery(<ClienteFormScreen />)
    expect(screen.queryByLabelText('Tope de crédito')).toBeNull()
    await completarAlta()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(cuerpoAlta()).not.toHaveProperty('topeCredito')
  })

  it('al editar, un tope sin tocar no se manda (ausente = no tocar) y uno borrado se quita', async () => {
    conPermisos(CON_CAP)
    mockId = 'c1'
    get.mockResolvedValue(detalle())
    renderConQuery(<ClienteFormScreen />)
    await waitFor(() => expect(screen.getByLabelText('Tope de crédito').props.value).toBe('300000'))

    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(put.mock.calls[0][1]).not.toHaveProperty('topeCredito')

    fireEvent.changeText(screen.getByLabelText('Tope de crédito'), '')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
    expect(put.mock.calls[1][1].topeCredito).toEqual({ monto: null })
  })
})

describe('solicitud de cambio desde la ficha', () => {
  function servidorFicha(cliente: object) {
    get.mockImplementation(async (url: string) => {
      if (url.includes('/estado-cuenta')) return { socioComercialId: 'c1', razonSocial: 'x', saldoActual: 0, saldoTst: 0, saldoNormal: 0, saldoAFavor: 0, movimientosPendientes: [] }
      if (url.startsWith('/api/v1/Ventas')) return pagina([], 0)
      return cliente
    })
  }
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    servidorFicha(detalle())
  })

  it('un vendedor dueño pide el cambio de dirección con su motivo y solo viaja lo que cambió', async () => {
    conPermisos(SIN_CAP)
    renderConQuery(<FichaCliente id="c1" />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))
    await userEvent.press(await screen.findByRole('button', { name: 'Pedir cambio' }))
    fireEvent.changeText(screen.getByLabelText('Nueva dirección de entrega'), 'Av. del Valle 120')
    fireEvent.changeText(screen.getByLabelText('Motivo'), 'Se mudó a la esquina')
    await userEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText(SOLICITUD_ENVIADA)).toBeTruthy()
    expect(post).toHaveBeenCalledWith('/api/v1/socios-comerciales/c1/solicitudes-cambio', {
      socioId: 'c1', direccion: 'Av. del Valle 120', motivo: 'Se mudó a la esquina',
    })
  })

  it('si el servidor rechaza, se ve su motivo', async () => {
    conPermisos(SIN_CAP)
    post.mockRejectedValue(new Error('Indicá el motivo del cambio.'))
    renderConQuery(<FichaCliente id="c1" />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))
    await userEvent.press(await screen.findByRole('button', { name: 'Pedir cambio' }))
    fireEvent.changeText(screen.getByLabelText('Nueva dirección de entrega'), 'Av. del Valle 120')
    await userEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText('Indicá el motivo del cambio.')).toBeTruthy()
    expect(screen.queryByText(SOLICITUD_ENVIADA)).toBeNull()
  })

  it('un administrador edita directo (regla de la web): no ve Pedir cambio', async () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'a', email: 'a@x.com', roles: ['Administrador'], permissions: SIN_CAP } as never })
    renderConQuery(<FichaCliente id="c1" />)

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeTruthy()
    await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))
    expect(screen.queryByRole('button', { name: 'Pedir cambio' })).toBeNull()
  })

  it('tener CAP_APROBAR_CAMBIOS_SOCIO sin ser administrador no alcanza: la web decide por administrador', async () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'a', email: 'a@x.com', roles: ['Empleado'], permissions: [...SIN_CAP, { module: 'CAP_APROBAR_CAMBIOS_SOCIO', canRead: true }] } as never })
    renderConQuery(<FichaCliente id="c1" />)

    await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))
    expect(await screen.findByRole('button', { name: 'Pedir cambio' })).toBeTruthy()
  })

  it('sin poder editar el cliente (otro dueño) tampoco puede pedir cambios', async () => {
    conPermisos(SIN_CAP)
    servidorFicha(detalle({ puedeEditar: false }))
    renderConQuery(<FichaCliente id="c1" />)

    expect(await screen.findByRole('header', { name: 'Av. del Valle 89' })).toBeTruthy()
    await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))
    expect(screen.queryByRole('button', { name: 'Pedir cambio' })).toBeNull()
  })
})

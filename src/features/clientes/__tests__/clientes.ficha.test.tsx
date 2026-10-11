import React from 'react'
import { Linking } from 'react-native'
import { screen, userEvent } from '@testing-library/react-native'
import { FichaCliente, AVISO_CONDICION_PAGO } from '../components/FichaCliente'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const detalle = (extra = {}) => ({
  ...clienteDeLista(),
  condicionesDeCompraFaltantes: [],
  condicionPago: { tipo: 'DiasDesdeEntrega', dias: 15 },
  topeCredito: 300000,
  ...extra,
})

function servidor(cliente: object) {
  get.mockImplementation(async (url: string) => {
    if (url.includes('/estado-cuenta')) return { socioComercialId: 'c1', razonSocial: 'x', saldoActual: 186420, saldoTst: 0, saldoNormal: 186420, saldoAFavor: 0, movimientosPendientes: [] }
    if (url.startsWith('/api/v1/Ventas')) return pagina([], 0)
    return cliente
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canUpdate: true }])
  servidor(detalle())
})

it('la dirección es el título y el nombre va aparte', async () => {
  renderConQuery(<FichaCliente id="c1" />)

  expect(await screen.findByRole('header', { name: 'Av. del Valle 89' })).toBeTruthy()
  expect(screen.getByText('Chela · Kiosco Chela')).toBeTruthy()
})

it('Llamar marca el teléfono y Cómo llegar abre el mapa con la dirección', async () => {
  renderConQuery(<FichaCliente id="c1" />)

  await userEvent.press(await screen.findByRole('button', { name: 'Llamar' }))
  expect(Linking.openURL).toHaveBeenCalledWith('tel:1146582291')
  await userEvent.press(screen.getByRole('button', { name: 'Cómo llegar' }))
  expect(Linking.openURL).toHaveBeenLastCalledWith(expect.stringContaining('query=Av.%20del%20Valle%2089'))
})

it('la cuenta corriente sale del endpoint vigente de estado de cuenta', async () => {
  renderConQuery(<FichaCliente id="c1" />)

  expect(await screen.findByLabelText('Saldo: $ 186.420,00')).toBeTruthy()
  expect(get).toHaveBeenCalledWith('/api/v1/cuentas-corrientes/socios/c1/estado-cuenta')
})

it('si el servidor no deja ver la cuenta, ni se pide ni se muestra', async () => {
  servidor(detalle({ puedeVerCuentaCorriente: false }))
  renderConQuery(<FichaCliente id="c1" />)

  await screen.findByText('Datos')
  expect(screen.queryByText('Cuenta corriente')).toBeNull()
  expect(get.mock.calls.some(([u]) => String(u).includes('estado-cuenta'))).toBe(false)
})

it('sin la capacidad de autorizar ventas, la condición de pago se ve con candado y el aviso', async () => {
  renderConQuery(<FichaCliente id="c1" />)

  expect(await screen.findByText('Cuenta corriente, 15 días desde la entrega')).toBeTruthy()
  expect(screen.getByText(AVISO_CONDICION_PAGO)).toBeTruthy()
})

it('con la capacidad de autorizar ventas no hay aviso de candado', async () => {
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true }, { module: 'CAP_AUTORIZAR_VENTA', canRead: true }])
  renderConQuery(<FichaCliente id="c1" />)

  await screen.findByText('Cuenta corriente, 15 días desde la entrega')
  expect(screen.queryByText(AVISO_CONDICION_PAGO)).toBeNull()
})

it('Editar solo aparece si el servidor dice que este usuario puede editarlo', async () => {
  servidor(detalle({ puedeEditar: false }))
  renderConQuery(<FichaCliente id="c1" />)

  await screen.findByText('Datos')
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
})

it('si el servidor rechaza, se ve su mensaje', async () => {
  get.mockRejectedValue(new Error('No tenés permisos para esta acción.'))
  renderConQuery(<FichaCliente id="c1" />)

  expect(await screen.findByText('No tenés permisos para esta acción.')).toBeTruthy()
})

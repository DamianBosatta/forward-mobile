import React from 'react'
import { Linking } from 'react-native'
import { screen, userEvent } from '@testing-library/react-native'
import { FichaProveedor } from '../components/FichaProveedor'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../../clientes/__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const detalle = (extra = {}) => ({
  ...clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: '30-70999888-5', tipo: 'Proveedor', direccion: '', nombreFantasia: null, nombreContacto: null, saldoAmount: 710430 }),
  condicionesDeCompraFaltantes: [],
  condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 },
  ...extra,
})
const compra = { id: 'k1', numero: 1783, proveedorId: 'p1', razonSocialProveedor: 'Insumos del Sur SA', fecha: '2026-10-15T12:00:00Z', estado: 'Pendiente', totalAmount: 1117500, itemsCount: 3, eliminada: false }

function servidor(socio: object, compras: object[] = [compra]) {
  get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/v1/Compras')) return pagina(compras, compras.length)
    return socio
  })
}

const PERMISOS = [{ module: 'MOD_PROVEEDORES', canRead: true, canUpdate: true }, { module: 'MOD_CC', canRead: true }]

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  conPermisos(PERMISOS)
  servidor(detalle())
})

it('la razón social es el título y debajo van el CUIT y cómo se le paga', async () => {
  renderConQuery(<FichaProveedor id="p1" />)

  expect(await screen.findByRole('header', { name: 'Insumos del Sur SA' })).toBeTruthy()
  expect(screen.getByText('CUIT 30-70999888-5 · paga a 30 días de factura')).toBeTruthy()
})

it('Llamar y WhatsApp salen del teléfono del proveedor', async () => {
  renderConQuery(<FichaProveedor id="p1" />)

  await userEvent.press(await screen.findByRole('button', { name: 'Llamar' }))
  expect(Linking.openURL).toHaveBeenCalledWith('tel:1146582291')
  await userEvent.press(screen.getByRole('button', { name: 'WhatsApp' }))
  expect(String((Linking.openURL as jest.Mock).mock.calls[1][0])).toContain('wa.me')
})

it('muestra lo que se le debe solo con saldo visible y MOD_CC:read', async () => {
  renderConQuery(<FichaProveedor id="p1" />)
  expect(await screen.findByText('Le debemos')).toBeTruthy()
})

it('sin MOD_CC:read no muestra el saldo (como la web)', async () => {
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true, canUpdate: true }])
  renderConQuery(<FichaProveedor id="p1" />)

  await screen.findByRole('header', { name: 'Insumos del Sur SA' })
  expect(screen.queryByText('Le debemos')).toBeNull()
})

it('si el servidor no deja ver el saldo, tampoco se muestra', async () => {
  servidor(detalle({ puedeVerSaldo: false }))
  renderConQuery(<FichaProveedor id="p1" />)

  await screen.findByRole('header', { name: 'Insumos del Sur SA' })
  expect(screen.queryByText('Le debemos')).toBeNull()
})

it('las compras salen del servidor filtradas por este proveedor y abren su detalle', async () => {
  renderConQuery(<FichaProveedor id="p1" />)

  const fila = await screen.findByRole('button', { name: /1783/ })
  expect(get.mock.calls.some(([u]) => String(u).startsWith('/api/v1/Compras') && String(u).includes('proveedorId=p1'))).toBe(true)
  await userEvent.press(fila)
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/compras/[id]', params: { id: 'k1' } })
})

it('sin compras lo dice', async () => {
  servidor(detalle(), [])
  renderConQuery(<FichaProveedor id="p1" />)
  expect(await screen.findByText('Todavía no se le compró nada.')).toBeTruthy()
})

it('Editar lo habilita MOD_PROVEEDORES:update y lleva al formulario del proveedor', async () => {
  renderConQuery(<FichaProveedor id="p1" />)

  await userEvent.press(await screen.findByRole('button', { name: 'Editar' }))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/proveedores/nuevo', params: { id: 'p1' } })
})

it('con solo MOD_CLIENTES:update no hay Editar ni Pedir cambio', async () => {
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true }, { module: 'MOD_CLIENTES', canRead: true, canUpdate: true }])
  renderConQuery(<FichaProveedor id="p1" />)

  await screen.findByRole('header', { name: 'Insumos del Sur SA' })
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Pedir cambio' })).toBeNull()
})

it('quien edita sin ser administrador puede Pedir cambio', async () => {
  renderConQuery(<FichaProveedor id="p1" />)
  expect(await screen.findByRole('button', { name: 'Pedir cambio' })).toBeTruthy()
})

it('un administrador edita directo y no ve Pedir cambio', async () => {
  useAuthStore.setState({ user: { id: 'u1', username: 'x', email: 'x@x.com', roles: ['Administrador'], permissions: PERMISOS } as never })
  renderConQuery(<FichaProveedor id="p1" />)

  await screen.findByRole('button', { name: 'Editar' })
  expect(screen.queryByRole('button', { name: 'Pedir cambio' })).toBeNull()
})

it('un proveedor sin condiciones de pago avisa que faltan', async () => {
  servidor(detalle({ condicionPago: undefined, condicionesDeCompraFaltantes: ['condicionPago'] }))
  renderConQuery(<FichaProveedor id="p1" />)

  expect(await screen.findByText(/Faltan datos para comprarle/)).toBeTruthy()
})

it('si el servidor rechaza, muestra su mensaje', async () => {
  get.mockRejectedValue(new Error('No tenés acceso a este proveedor.'))
  renderConQuery(<FichaProveedor id="p1" />)
  expect(await screen.findByText('No tenés acceso a este proveedor.')).toBeTruthy()
})

describe('Nueva compra desde el proveedor (ResFichaProveedor)', () => {
  it('con MOD_COMPRAS:create aparece y abre la compra nueva con ese proveedor', async () => {
    conPermisos([...PERMISOS, { module: 'MOD_COMPRAS', canRead: true, canCreate: true }])
    renderConQuery(<FichaProveedor id="p1" />)

    await userEvent.press(await screen.findByRole('button', { name: 'Nueva compra' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/compras/nueva', params: { proveedor: 'p1' } })
  })

  it('sin MOD_COMPRAS:create no aparece', async () => {
    conPermisos([...PERMISOS, { module: 'MOD_COMPRAS', canRead: true }])
    renderConQuery(<FichaProveedor id="p1" />)

    await screen.findByRole('header', { name: 'Insumos del Sur SA' })
    expect(screen.queryByRole('button', { name: 'Nueva compra' })).toBeNull()
  })
})

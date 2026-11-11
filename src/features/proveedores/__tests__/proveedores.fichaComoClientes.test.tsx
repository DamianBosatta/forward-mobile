import React from 'react'
import { ActivityIndicator, Linking, StyleSheet } from 'react-native'
import { screen, userEvent, within } from '@testing-library/react-native'
import { FichaProveedor } from '../components/FichaProveedor'
import { api } from '@/core/api/client'
import { themeColors } from '@/libs/theme'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../../clientes/__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

/** S9: la ficha del proveedor con el mismo estilo que la ficha del cliente (propuesta "Clientes como venta", frames 5 a 12). */
const get = api.get as jest.Mock
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>
const detalle = (extra = {}) => ({
  ...clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', cuit: '30-70999888-5', tipo: 'Proveedor', direccion: 'Ruta 2 km 40', nombreFantasia: null, nombreContacto: null, saldoAmount: 710430 }),
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
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  conPermisos(PERMISOS)
  servidor(detalle())
})

describe('hero de saldo (frame 5)', () => {
  it('lo que se le debe va en la tarjeta oscura de la ficha del cliente, con su etiqueta', async () => {
    renderConQuery(<FichaProveedor id="p1" />)

    const hero = await screen.findByTestId('hero-saldo')
    expect(estilo(hero).backgroundColor).toBe(themeColors.light.topBar)
    expect(within(hero).getByLabelText('Le debemos $ 710.430,00')).toBeTruthy()
    expect(within(hero).getByText('Le debemos')).toBeTruthy()
    expect(within(hero).queryByText('Saldo')).toBeNull()
  })

  it('sin saldo visible no hay hero', async () => {
    servidor(detalle({ puedeVerSaldo: false }))
    renderConQuery(<FichaProveedor id="p1" />)

    await screen.findByRole('header', { name: 'Insumos del Sur SA' })
    expect(screen.queryByTestId('hero-saldo')).toBeNull()
  })
})

describe('acciones sin borde (frame 5)', () => {
  it('Llamar, WhatsApp y Cómo llegar no llevan borde', async () => {
    renderConQuery(<FichaProveedor id="p1" />)

    for (const accion of ['Llamar', 'WhatsApp', 'Cómo llegar']) {
      expect(estilo(await screen.findByRole('button', { name: accion })).borderWidth ?? 0).toBe(0)
    }
  })
})

describe('solapas (frames 5 a 7)', () => {
  it('Compras: las compras recientes son filas de una tarjeta, con flecha', async () => {
    renderConQuery(<FichaProveedor id="p1" />)

    const fila = await screen.findByRole('button', { name: /1783/ })
    expect(within(fila).getAllByTestId('compra-chevron').length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('lista-compras-recientes')).getByText('Compra 1783')).toBeTruthy()
  })

  it('Condiciones: plazo de pago y horarios de entrega en su solapa', async () => {
    renderConQuery(<FichaProveedor id="p1" />)
    await screen.findByTestId('hero-saldo')
    expect(screen.queryByText('Plazo de pago')).toBeNull()

    await userEvent.press(screen.getByRole('radio', { name: 'Condiciones' }))
    expect(screen.getByRole('header', { name: 'Condiciones de compra' })).toBeTruthy()
    expect(screen.getByText('30 días de factura')).toBeTruthy()
    expect(screen.getByText('A confirmar')).toBeTruthy()
  })

  it('Datos: los datos con la etiqueta chica y "Pedir cambio" abre la hoja desde abajo', async () => {
    renderConQuery(<FichaProveedor id="p1" />)
    expect(screen.queryByRole('button', { name: 'Pedir cambio' })).toBeNull()
    await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))

    expect(screen.getByText('Ruta 2 km 40')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Pedir cambio' }))
    const hoja = screen.getByLabelText('Pedir cambio de datos')
    expect(within(hoja).getByLabelText('Nueva razón social').props.value).toBe('Insumos del Sur SA')
  })
})

describe('pie fijo como el de la ficha del cliente', () => {
  it('"Nueva compra" va en el pie también en el panel de la tablet', async () => {
    conPermisos([...PERMISOS, { module: 'MOD_COMPRAS', canRead: true, canCreate: true }])
    renderConQuery(<FichaProveedor id="p1" />)

    await userEvent.press(await screen.findByRole('button', { name: 'Nueva compra' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/compras/nueva', params: { proveedor: 'p1' } })
    expect(screen.getByTestId('pie-ficha-proveedor')).toBeTruthy()
  })
})

describe('estados (frame 12)', () => {
  it('mientras carga se ven esqueletos con la forma del hero y de las filas, no la ruedita', async () => {
    get.mockImplementation(() => new Promise(() => {}))
    renderConQuery(<FichaProveedor id="p1" conBarra />)

    expect(await screen.findByTestId('esqueleto-hero')).toBeTruthy()
    expect(screen.getAllByTestId('esqueleto-fila')).toHaveLength(2)
    expect(screen.getByText('Proveedor')).toBeTruthy()
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
  })

  it('mientras cargan las compras se ven esqueletos de fila', async () => {
    get.mockImplementation(async (url: string) => (url.startsWith('/api/v1/Compras') ? new Promise(() => {}) : detalle()))
    renderConQuery(<FichaProveedor id="p1" />)

    await screen.findByTestId('hero-saldo')
    expect(screen.getAllByTestId('esqueleto-fila').length).toBeGreaterThan(0)
  })
})

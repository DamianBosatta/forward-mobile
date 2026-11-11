import React from 'react'
import { Linking, StyleSheet } from 'react-native'
import { screen, userEvent, within } from '@testing-library/react-native'
import { FichaCliente } from '../components/FichaCliente'
import { api } from '@/core/api/client'
import { themeColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

/** Propuesta "Clientes como venta", frames 5, 6, 7, 11 y 12: misma ficha, con el modelo visual de la venta. */
const get = api.get as jest.Mock
const detalle = (extra = {}) => ({ ...clienteDeLista(), condicionesDeCompraFaltantes: [], condicionPago: { tipo: 'Contado' }, topeCredito: 300000, ...extra })
const estilo = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>

function servidor(cliente: object, credito: object = {}, ventas: object[] = []) {
  get.mockImplementation(async (url: string) => {
    if (url.includes('/estado-cuenta')) return { socioComercialId: 'c1', razonSocial: 'x', saldoActual: 186420, saldoTst: 0, saldoNormal: 186420, saldoAFavor: 0, movimientosPendientes: [], ...credito }
    if (url.startsWith('/api/v1/Ventas')) return pagina(ventas, ventas.length)
    return cliente
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canUpdate: true }])
  servidor(detalle())
})

describe('hero de saldo (frames 5 y 11)', () => {
  it('el saldo va en una tarjeta oscura con la cifra grande y el crédito libre', async () => {
    servidor(detalle(), { creditoDisponible: 250000 })
    renderConQuery(<FichaCliente id="c1" />)

    const hero = await screen.findByTestId('hero-saldo')
    expect(estilo(hero).backgroundColor).toBe(themeColors.light.topBar)
    expect(within(hero).getByLabelText('Saldo $ 186.420,00')).toBeTruthy()
    expect(within(hero).getByText('Crédito libre')).toBeTruthy()
    expect(estilo(within(hero).getByTestId('hero-credito-relleno')).backgroundColor).toBe(themeColors.light.brand)
  })

  it('pasado del tope: la barra pasa a amarillo y el importe va en un chip rojo con "Pasado del tope"', async () => {
    servidor(detalle(), { creditoDisponible: -12000 })
    renderConQuery(<FichaCliente id="c1" />)

    const hero = await screen.findByTestId('hero-saldo')
    expect(within(hero).getByText('Pasado del tope')).toBeTruthy()
    expect(within(hero).getByLabelText('Estado: $ 12.000,00')).toBeTruthy()
    expect(within(hero).queryByText('Crédito libre')).toBeNull()
    expect(estilo(within(hero).getByTestId('hero-credito-relleno')).backgroundColor).toBe(themeColors.light.warning)
  })

  it('con más del 80 % del tope usado la barra también avisa en amarillo', async () => {
    servidor(detalle(), { creditoDisponible: 30000 })
    renderConQuery(<FichaCliente id="c1" />)

    const hero = await screen.findByTestId('hero-saldo')
    expect(within(hero).getByText('Crédito libre')).toBeTruthy()
    expect(estilo(within(hero).getByTestId('hero-credito-relleno')).backgroundColor).toBe(themeColors.light.warning)
  })

  it('TST y Normal van en dos tarjetas aparte, fuera del hero', async () => {
    renderConQuery(<FichaCliente id="c1" />)

    const hero = await screen.findByTestId('hero-saldo')
    expect(within(hero).queryByText('Cuenta TST')).toBeNull()
    expect(screen.getByLabelText('Cuenta TST: $ 0,00')).toBeTruthy()
    expect(screen.getByLabelText('Normal (con factura): $ 186.420,00')).toBeTruthy()
  })
})

describe('solapas (frames 5, 6 y 7)', () => {
  it('Cuenta: los totales en una tarjeta y el saldo como renglón final, con el aviso de deuda fuera de la tarjeta', async () => {
    servidor(detalle(), { tieneDeudaVencida: true, deudaVencida: 86400, deudaVencidaTst: 86400, creditoDisponible: 113580 })
    renderConQuery(<FichaCliente id="c1" />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Cuenta' }))

    const totales = await screen.findByTestId('totales-cuenta')
    const renglones = within(totales).getAllByLabelText(/: \$/).map(r => r.props.accessibilityLabel as string)
    expect(renglones[0]).toBe(`Tope de crédito: ${formatImporte(300000)}`)
    expect(renglones[renglones.length - 1]).toBe(`Saldo: ${formatImporte(186420)}`)
    expect(within(totales).queryByText(/los pedidos nuevos van a quedar por autorizar/)).toBeNull()
    expect(screen.getByText(/los pedidos nuevos van a quedar por autorizar/)).toBeTruthy()
  })

  it('Compras: las últimas ventas son filas de una tarjeta, con flecha', async () => {
    servidor(detalle(), {}, [{ id: 'v1', codigoPedido: 'PED-000123', fecha: '2026-11-10T12:00:00Z', tipoOperacion: 0, totalAmount: 52300, estado: 'Confirmado' }])
    renderConQuery(<FichaCliente id="c1" />)

    const fila = await screen.findByRole('button', { name: /PED-000123/ })
    expect(within(fila).getAllByTestId('venta-chevron').length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('lista-ultimas-ventas')).getByText('PED-000123')).toBeTruthy()
  })

  it('Datos: la condición de pago es una fila bloqueada con candado y la razón escrita', async () => {
    renderConQuery(<FichaCliente id="c1" />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Datos' }))

    const fila = screen.getByLabelText('Condición de pago: Contado. Solo la cambia quien puede autorizar ventas')
    expect(within(fila).getAllByTestId('candado').length).toBeGreaterThan(0)
  })
})

describe('acciones sin borde (frame 5)', () => {
  it('Llamar, WhatsApp y Cómo llegar no llevan borde', async () => {
    renderConQuery(<FichaCliente id="c1" />)

    const llamar = await screen.findByRole('button', { name: 'Llamar' })
    expect(estilo(llamar).borderWidth ?? 0).toBe(0)
  })
})

describe('estados (frame 12)', () => {
  it('mientras carga se ven esqueletos con la forma del hero y de las filas, no la ruedita', async () => {
    get.mockImplementation(() => new Promise(() => {}))
    renderConQuery(<FichaCliente id="c1" conBarra />)

    expect(await screen.findByTestId('esqueleto-hero')).toBeTruthy()
    expect(screen.getAllByTestId('esqueleto-fila')).toHaveLength(2)
    expect(screen.getByText('Cliente')).toBeTruthy()
  })
})

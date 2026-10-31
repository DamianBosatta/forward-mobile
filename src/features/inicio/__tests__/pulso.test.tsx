import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { PulsoDelNegocio } from '../components/PulsoDelNegocio'
import { AtajosDeInicio } from '../components/AtajosDeInicio'

const NBSP = '\u00a0'

describe('Inicio general: el pulso del negocio (lámina inicio-general)', () => {
  it('muestra ventas del día, pedidos pendientes, rutas activas, me deben y debo', () => {
    render(
      <PulsoDelNegocio ventasDelDia={1284500} cantidadVentas={18} pedidosPendientes={14} rutasActivas={3} meDeben={48920300} debo={21150000} />,
    )
    expect(screen.getByLabelText(`Ventas del día: $${NBSP}1.284.500,00, 18 ventas`)).toBeTruthy()
    expect(screen.getByLabelText('Pedidos pendientes: 14')).toBeTruthy()
    expect(screen.getByLabelText('Rutas activas: 3')).toBeTruthy()
    expect(screen.getByLabelText(`Me deben los clientes: $${NBSP}48.920.300,00`)).toBeTruthy()
    expect(screen.getByLabelText(`Debo a proveedores: $${NBSP}21.150.000,00`)).toBeTruthy()
  })

  it('sin dato del servidor muestra "—", nunca 0', () => {
    render(<PulsoDelNegocio ventasDelDia={null} cantidadVentas={null} pedidosPendientes={null} rutasActivas={null} meDeben={null} debo={null} />)
    expect(screen.getByLabelText('Ventas del día: —')).toBeTruthy()
    expect(screen.getByLabelText('Pedidos pendientes: —')).toBeTruthy()
    expect(screen.getByLabelText('Me deben los clientes: —')).toBeTruthy()
  })

  it('1 venta va en singular', () => {
    render(<PulsoDelNegocio ventasDelDia={100} cantidadVentas={1} pedidosPendientes={0} rutasActivas={0} meDeben={null} debo={null} />)
    expect(screen.getByLabelText(`Ventas del día: $${NBSP}100,00, 1 venta`)).toBeTruthy()
    expect(screen.getByLabelText('Rutas activas: 0')).toBeTruthy()
  })
})

describe('Inicio general: deuda vencida de los clientes', () => {
  it('con el dato muestra la cifra de deuda vencida', () => {
    render(<PulsoDelNegocio ventasDelDia={null} cantidadVentas={null} pedidosPendientes={0} rutasActivas={0} meDeben={100} debo={null} deudaVencida={2500000} />)
    expect(screen.getByLabelText(`Vencido (más de 30 días): $${NBSP}2.500.000,00`)).toBeTruthy()
  })

  it('sin el dato no muestra la cifra', () => {
    render(<PulsoDelNegocio ventasDelDia={null} cantidadVentas={null} pedidosPendientes={0} rutasActivas={0} meDeben={null} debo={null} />)
    expect(screen.queryByLabelText(/Vencido/)).toBeNull()
  })
})

describe('Inicio general: accesos rápidos', () => {
  it('cada atajo abre su pantalla y solo aparecen los que el usuario puede usar', async () => {
    const ir = jest.fn()
    render(<AtajosDeInicio puede={{ vender: true, cobrar: false, catalogo: true, stock: true }} onIr={ir} />)
    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Nueva venta' }))
    await userEvent.press(screen.getByRole('button', { name: 'Catálogo' }))
    await userEvent.press(screen.getByRole('button', { name: 'Stock' }))
    expect(ir.mock.calls.map((c) => c[0])).toEqual(['/(tabs)/ventas/nueva', '/(tabs)/inventario', '/(tabs)/inventario/stock'])
  })
})

describe('Inicio general: la tarjeta de ventas del día en cada tema', () => {
  const { StyleSheet } = require('react-native')
  const { useThemeStore, themeColors } = require('@/libs/theme')
  afterEach(() => useThemeStore.setState({ mode: 'system' }))

  const estiloHero = () => StyleSheet.flatten(screen.getByTestId('pulso-hero').props.style)
  const pintar = () =>
    render(<PulsoDelNegocio ventasDelDia={100} cantidadVentas={2} pedidosPendientes={0} rutasActivas={0} meDeben={null} debo={null} />)

  it('en oscuro usa la superficie con borde, no el fondo de la página', () => {
    useThemeStore.setState({ mode: 'dark' })
    pintar()
    expect(estiloHero().backgroundColor).toBe(themeColors.dark.surface)
    expect(estiloHero().borderColor).toBe(themeColors.dark.border)
    expect(estiloHero().backgroundColor).not.toBe(themeColors.dark.bg)
  })

  it('en claro sigue siendo la tarjeta oscura de la barra', () => {
    useThemeStore.setState({ mode: 'light' })
    pintar()
    expect(estiloHero().backgroundColor).toBe(themeColors.light.topBar)
  })
})

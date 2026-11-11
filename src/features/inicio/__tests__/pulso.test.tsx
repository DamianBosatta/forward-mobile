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

describe('Inicio general: el hero de ventas del día en cada tema', () => {
  const { StyleSheet } = require('react-native')
  const { useThemeStore, themeColors } = require('@/libs/theme')
  afterEach(() => useThemeStore.setState({ mode: 'system' }))

  const estiloHero = () => StyleSheet.flatten(screen.getByTestId('pulso-hero').props.style)
  const pintar = () =>
    render(<PulsoDelNegocio ventasDelDia={100} cantidadVentas={2} pedidosPendientes={0} rutasActivas={0} meDeben={null} debo={null} />)

  it('"Ventas del día" va en el hero oscuro, igual en los dos temas (galería v2)', () => {
    for (const mode of ['dark', 'light']) {
      useThemeStore.setState({ mode })
      const r = pintar()
      expect(estiloHero().backgroundColor).toBe(themeColors.dark.brandSoft)
      r.unmount()
    }
  })

  it('"Rutas activas" abre la lista de hojas de ruta; sin destino no es un botón', async () => {
    const onRutas = jest.fn()
    const { rerender } = render(
      <PulsoDelNegocio ventasDelDia={0} cantidadVentas={0} pedidosPendientes={0} rutasActivas={3} meDeben={0} debo={0} onRutas={onRutas} />,
    )
    await userEvent.press(screen.getByRole('button', { name: 'Rutas activas: 3' }))
    expect(onRutas).toHaveBeenCalledTimes(1)
    rerender(<PulsoDelNegocio ventasDelDia={0} cantidadVentas={0} pedidosPendientes={0} rutasActivas={3} meDeben={0} debo={0} />)
    expect(screen.queryByRole('button', { name: 'Rutas activas: 3' })).toBeNull()
  })
})

describe('Inicio general: propuesta (frames 6 a 9)', () => {
  const { StyleSheet } = require('react-native')
  const { themeColors, useThemeStore } = require('@/libs/theme')
  afterEach(() => useThemeStore.setState({ mode: 'system' }))

  it('los atajos van sin borde y "Nueva venta" en color de acción', () => {
    useThemeStore.setState({ mode: 'light' })
    render(<AtajosDeInicio puede={{ vender: true, cobrar: true, catalogo: true, stock: true }} onIr={jest.fn()} />)
    const estilo = (n: string) => StyleSheet.flatten(screen.getByRole('button', { name: n }).props.style)
    expect(estilo('Nueva venta').backgroundColor).toBe(themeColors.light.action)
    expect(estilo('Cobrar').borderWidth ?? 0).toBe(0)
    expect(estilo('Nueva venta').borderWidth ?? 0).toBe(0)
  })

  it('lo que va entre el hero y los mosaicos (los atajos) se dibuja ahí', () => {
    render(
      <PulsoDelNegocio ventasDelDia={1} cantidadVentas={1} pedidosPendientes={1} rutasActivas={1} meDeben={1} debo={1}>
        <AtajosDeInicio puede={{ vender: true, cobrar: false, catalogo: false, stock: false }} onIr={jest.fn()} />
      </PulsoDelNegocio>,
    )
    expect(screen.getByRole('button', { name: 'Nueva venta' })).toBeTruthy()
  })

  it('sin dato, "—" en el hero, en los mosaicos y en la lista; nunca 0', () => {
    render(<PulsoDelNegocio ventasDelDia={null} cantidadVentas={null} pedidosPendientes={null} rutasActivas={null} meDeben={null} debo={null} />)
    expect(screen.getAllByText('—')).toHaveLength(5)
    expect(screen.queryByText(/ventas$/)).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('"Vencido" lleva un punto rojo y solo aparece si el servidor lo manda', () => {
    render(<PulsoDelNegocio ventasDelDia={1} cantidadVentas={1} pedidosPendientes={1} rutasActivas={1} meDeben={1} debo={1} deudaVencida={486300} />)
    expect(screen.getByTestId('vencido-punto')).toBeTruthy()
  })
})

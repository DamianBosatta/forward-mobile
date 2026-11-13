import React from 'react'
import { Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { PulsoDelNegocio } from '../components/PulsoDelNegocio'

// La tarjeta Deudores tiene su propio test (deudores.test.tsx); acá solo importa dónde se dibuja.
jest.mock('../components/DeudoresDeInicio', () => {
  const { Text } = require('react-native')
  return { DeudoresDeInicio: () => <Text>tarjeta-deudores-mock</Text> }
})

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

describe('Inicio general: Deudores destaca entre el hero y los mosaicos', () => {
  it('la tarjeta Deudores se dibuja y el pulso ya no trae atajos ni la cifra de vencido', () => {
    render(<PulsoDelNegocio ventasDelDia={1} cantidadVentas={1} pedidosPendientes={1} rutasActivas={1} meDeben={1} debo={1} />)
    expect(screen.getByText('tarjeta-deudores-mock')).toBeTruthy()
    expect(screen.queryByLabelText(/Vencido/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nueva venta' })).toBeNull()
  })
})

describe('Inicio general: el hero de ventas del día en cada tema', () => {
  const { StyleSheet } = require('react-native')
  const { useThemeStore, themeColors } = require('@/libs/theme')
  afterEach(() => useThemeStore.setState({ mode: 'system' }))

  const estiloHero = () => StyleSheet.flatten(screen.getByTestId('pulso-hero').props.style)
  const pintar = () =>
    render(<PulsoDelNegocio ventasDelDia={100} cantidadVentas={2} pedidosPendientes={0} rutasActivas={0} meDeben={null} debo={null} />)

  it('"Ventas del día" va en el hero con la marca-suave de cada tema (auditoría de UI, tanda 6)', () => {
    for (const mode of ['dark', 'light'] as const) {
      useThemeStore.setState({ mode })
      const r = pintar()
      expect(estiloHero().backgroundColor).toBe(themeColors[mode].brandSoft)
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
  it('lo que va entre el hero y Deudores (en tablet, "Nueva venta") se dibuja ahí', () => {
    render(
      <PulsoDelNegocio ventasDelDia={1} cantidadVentas={1} pedidosPendientes={1} rutasActivas={1} meDeben={1} debo={1}>
        <Text>en-el-medio</Text>
      </PulsoDelNegocio>,
    )
    expect(screen.getByText('en-el-medio')).toBeTruthy()
  })

  it('sin dato, "—" en el hero, en los mosaicos y en la lista; nunca 0', () => {
    render(<PulsoDelNegocio ventasDelDia={null} cantidadVentas={null} pedidosPendientes={null} rutasActivas={null} meDeben={null} debo={null} />)
    expect(screen.getAllByText('—')).toHaveLength(5)
    expect(screen.queryByText(/ventas$/)).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })
})

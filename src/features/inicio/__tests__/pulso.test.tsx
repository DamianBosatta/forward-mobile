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
  it('muestra ventas del día, pedidos pendientes, rutas activas y debo', () => {
    render(
      <PulsoDelNegocio ventasDelDia={1284500} cantidadVentas={18} pedidosPendientes={14} rutasActivas={3} debo={21150000} />,
    )
    expect(screen.getByLabelText(`Ventas del día: $${NBSP}1.284.500,00, 18 ventas`)).toBeTruthy()
    expect(screen.getByLabelText('Pedidos pendientes: 14')).toBeTruthy()
    expect(screen.getByLabelText('Rutas activas: 3')).toBeTruthy()
    // MB-4: lo que deben los clientes lo dice la tarjeta Deudores; no hay un segundo mosaico con otro nombre.
    expect(screen.queryByLabelText(/^Me deben los clientes/)).toBeNull()
    expect(screen.getByLabelText(`Debo a proveedores: $${NBSP}21.150.000,00`)).toBeTruthy()
  })

  it('sin dato del servidor muestra "—", nunca 0', () => {
    render(<PulsoDelNegocio ventasDelDia={null} cantidadVentas={null} pedidosPendientes={null} rutasActivas={null} debo={null} />)
    expect(screen.getByLabelText('Ventas del día: —')).toBeTruthy()
    expect(screen.getByLabelText('Pedidos pendientes: —')).toBeTruthy()
  })

  it('1 venta va en singular', () => {
    render(<PulsoDelNegocio ventasDelDia={100} cantidadVentas={1} pedidosPendientes={0} rutasActivas={0} debo={null} />)
    expect(screen.getByLabelText(`Ventas del día: $${NBSP}100,00, 1 venta`)).toBeTruthy()
    expect(screen.getByLabelText('Rutas activas: 0')).toBeTruthy()
  })
})

describe('Inicio general: Deudores destaca entre el hero y los mosaicos', () => {
  it('la tarjeta Deudores se dibuja y el pulso ya no trae atajos ni la cifra de vencido', () => {
    render(<PulsoDelNegocio ventasDelDia={1} cantidadVentas={1} pedidosPendientes={1} rutasActivas={1} debo={1} />)
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
    render(<PulsoDelNegocio ventasDelDia={100} cantidadVentas={2} pedidosPendientes={0} rutasActivas={0} debo={null} />)

  it('"Ventas del día" va en el hero en lima de marca en cada tema (auditoría de UI, tanda 6)', () => {
    for (const mode of ['dark', 'light'] as const) {
      useThemeStore.setState({ mode })
      const r = pintar()
      expect(estiloHero().backgroundColor).toBe(themeColors[mode].lime)
      r.unmount()
    }
  })

  it('"Rutas activas" abre la lista de hojas de ruta; sin destino no es un botón', async () => {
    const onRutas = jest.fn()
    const { rerender } = render(
      <PulsoDelNegocio ventasDelDia={0} cantidadVentas={0} pedidosPendientes={0} rutasActivas={3} debo={0} onRutas={onRutas} />,
    )
    await userEvent.press(screen.getByRole('button', { name: 'Rutas activas: 3' }))
    expect(onRutas).toHaveBeenCalledTimes(1)
    rerender(<PulsoDelNegocio ventasDelDia={0} cantidadVentas={0} pedidosPendientes={0} rutasActivas={3} debo={0} />)
    expect(screen.queryByRole('button', { name: 'Rutas activas: 3' })).toBeNull()
  })
})

describe('Inicio general: los dos mosaicos de una fila se tocan igual (MB-6)', () => {
  it('con destino, "Pedidos pendientes" y "Rutas activas" son botones; sin destino ninguno lo es', async () => {
    const onPedidos = jest.fn()
    const { rerender } = render(<PulsoDelNegocio ventasDelDia={0} cantidadVentas={0} pedidosPendientes={4} rutasActivas={3} debo={0} onPedidos={onPedidos} onRutas={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: 'Pedidos pendientes: 4' }))
    expect(onPedidos).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Rutas activas: 3' })).toBeTruthy()
    rerender(<PulsoDelNegocio ventasDelDia={0} cantidadVentas={0} pedidosPendientes={4} rutasActivas={3} debo={0} />)
    expect(screen.queryByRole('button', { name: 'Pedidos pendientes: 4' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rutas activas: 3' })).toBeNull()
  })
})

describe('Inicio general: propuesta (frames 6 a 9)', () => {
  it('lo que va entre el hero y Deudores (en tablet, "Nueva venta") se dibuja ahí', () => {
    render(
      <PulsoDelNegocio ventasDelDia={1} cantidadVentas={1} pedidosPendientes={1} rutasActivas={1} debo={1}>
        <Text>en-el-medio</Text>
      </PulsoDelNegocio>,
    )
    expect(screen.getByText('en-el-medio')).toBeTruthy()
  })

  it('sin dato, "—" en el hero, en los mosaicos y en la lista; nunca 0', () => {
    render(<PulsoDelNegocio ventasDelDia={null} cantidadVentas={null} pedidosPendientes={null} rutasActivas={null} debo={null} />)
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.queryByText(/ventas$/)).toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })
})

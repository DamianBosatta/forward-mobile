import React from 'react'
import { Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { House, User } from 'lucide-react-native'
import { themeColors } from '@/libs/theme'
import { BottomBar, NuevaVentaCentral, ALTO_BARRA_CON_CENTRO, DIAMETRO_NUEVA_VENTA } from '../index'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))

afterEach(() => conTema('light'))

const items = [
  { key: 'inicio', label: 'Mi día', icon: House, onPress: jest.fn() },
  { key: 'clientes', label: 'Clientes', icon: User, onPress: jest.fn() },
]

describe.each(TEMAS)('NuevaVentaCentral y BottomBar con botón central (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('es un botón "Nueva venta" de 64 pt, en color de acción, que responde al toque', async () => {
    const alTocar = jest.fn()
    render(<NuevaVentaCentral onPress={alTocar} />)
    const boton = screen.getByRole('button', { name: 'Nueva venta' })
    expect(estilo(boton)).toMatchObject({ width: DIAMETRO_NUEVA_VENTA, height: DIAMETRO_NUEVA_VENTA, backgroundColor: themeColors[tema].action })
    await userEvent.press(boton)
    expect(alTocar).toHaveBeenCalledTimes(1)
  })

  it('la barra sube de alto solo con `center` y el botón con su etiqueta entra entero en sus límites', () => {
    const { rerender } = render(<BottomBar items={items} center={<Text>centro</Text>} />)
    expect(estilo(screen.getByLabelText('Acciones rápidas')).height).toBe(ALTO_BARRA_CON_CENTRO)
    // Android no entrega toques fuera del padre: el botón (64) más la etiqueta y el aire tienen que caber.
    expect(DIAMETRO_NUEVA_VENTA + 16).toBeLessThanOrEqual(ALTO_BARRA_CON_CENTRO)
    expect(screen.getByTestId('barra-centro')).toBeTruthy()
    rerender(<BottomBar items={items} />)
    expect(estilo(screen.getByLabelText('Acciones rápidas')).height).toBe(76)
    expect(screen.queryByTestId('barra-centro')).toBeNull()
  })

  it('el botón central va entre los accesos y su toque llega', async () => {
    const alTocar = jest.fn()
    render(<BottomBar items={items} center={<NuevaVentaCentral onPress={alTocar} />} />)
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Mi día', 'Nueva venta', 'Clientes'])
    await userEvent.press(screen.getByRole('button', { name: 'Nueva venta' }))
    expect(alTocar).toHaveBeenCalledTimes(1)
  })
})

import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { themeColors } from '@/libs/theme'
import { Button } from '@/core/ui/fw'
import type { ParadaDto } from '@/libs/api-client/types'
import { LlegueParada } from '../consola/LlegueParada'
import { conTema, estilo } from '@/core/ui/fw/__testing__/tema'

jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()] }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))

const parada = { id: 'p1', clienteNombre: 'Almacén Don Pepe', direccion: 'Av. Rivadavia 7420', cantidadBultos: 3 } as ParadaDto

describe.each(['light', 'dark'] as const)('pantalla Llegué (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('dice cuántas piezas son, con el término "piezas", y no ofrece escanear sin etiquetas del servidor (TODO API)', () => {
    render(<LlegueParada parada={parada} onVolver={jest.fn()} onEntregueTodo={jest.fn()} onNoPudeEntregar={jest.fn()} />)
    expect(screen.getByText('Tenés 3 piezas para entregar acá')).toBeTruthy()
    expect(screen.getByLabelText('Pieza 2 de 3')).toBeTruthy()
    expect(screen.queryByLabelText('Escanear etiqueta')).toBeNull()
    expect(screen.queryByText(/bulto/i)).toBeNull()
  })

  it('tildar una pieza la marca con tilde (no solo color) y "Entregué todo" no pregunta por las sin tildar', async () => {
    const onEntregueTodo = jest.fn()
    render(<LlegueParada parada={parada} onVolver={jest.fn()} onEntregueTodo={onEntregueTodo} onNoPudeEntregar={jest.fn()} />)
    const fila = screen.getByLabelText('Pieza 1 de 3')
    expect(fila.props.accessibilityState.checked).toBe(false)
    await userEvent.press(fila)
    expect(screen.getByLabelText('Pieza 1 de 3').props.accessibilityState.checked).toBe(true)
    await userEvent.press(screen.getByLabelText('Entregué todo'))
    expect(onEntregueTodo).toHaveBeenCalledTimes(1)
  })

  it('"No pude entregar" sigue su camino y los botones grandes miden 72', async () => {
    const onNo = jest.fn()
    render(<LlegueParada parada={parada} onVolver={jest.fn()} onEntregueTodo={jest.fn()} onNoPudeEntregar={onNo} />)
    await userEvent.press(screen.getByLabelText('No pude entregar'))
    expect(onNo).toHaveBeenCalledTimes(1)
    expect(estilo(screen.getByLabelText('Entregué todo')).height).toBe(72)
    expect(estilo(screen.getByLabelText('No pude entregar')).borderColor).toBe(themeColors[tema].textSecondary)
  })
})

describe('Button size', () => {
  it('md conserva el alto de siempre (48) y xl llega a 72', () => {
    conTema('light')
    render(<><Button label="Normal" onPress={jest.fn()} /><Button label="Grande" size="xl" onPress={jest.fn()} /></>)
    expect(StyleSheet.flatten(screen.getByLabelText('Normal').props.style).height).toBe(48)
    expect(StyleSheet.flatten(screen.getByLabelText('Grande').props.style).height).toBe(72)
  })
})

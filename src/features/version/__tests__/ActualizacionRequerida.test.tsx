import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useThemeStore } from '@/libs/theme'
import { ActualizacionRequerida } from '../ActualizacionRequerida'

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }

describe.each(['light', 'dark'] as const)('ActualizacionRequerida, tema %s', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it.each([
    ['teléfono', { width: 360, height: 800 }],
    ['tablet', { width: 800, height: 1280 }],
  ])('en %s dice que hay que actualizar, las versiones y a quién pedir ayuda', (_n, frame) => {
    render(
      <SafeAreaProvider initialMetrics={{ ...metrics, frame: { x: 0, y: 0, ...frame } }}>
        <ActualizacionRequerida instalada="1.0.0" minima="1.4.0" onReintentar={jest.fn()} />
      </SafeAreaProvider>,
    )
    expect(screen.getByText('Hay que actualizar la app')).toBeTruthy()
    expect(screen.getByText(/administrador/)).toBeTruthy()
    expect(screen.getByText(/1\.0\.0/)).toBeTruthy()
    expect(screen.getByText(/1\.4\.0/)).toBeTruthy()
  })

  it('la columna tiene ancho máximo, para que en tablet horizontal el texto no sea una sola línea', () => {
    render(
      <SafeAreaProvider initialMetrics={{ ...metrics, frame: { x: 0, y: 0, width: 2560, height: 1600 } }}>
        <ActualizacionRequerida instalada="1.0.0" minima="1.4.0" onReintentar={jest.fn()} />
      </SafeAreaProvider>,
    )
    const anchos: unknown[] = []
    let nodo = screen.getByText('Hay que actualizar la app').parent
    while (nodo) {
      const estilo = [nodo.props.style].flat(Infinity) as Array<Record<string, unknown> | undefined>
      for (const e of estilo) if (e && e.maxWidth !== undefined) anchos.push(e.maxWidth)
      nodo = nodo.parent
    }
    expect(anchos).toContain(560)
  })

  it('Volver a comprobar llama a onReintentar', () => {
    const onReintentar = jest.fn()
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ActualizacionRequerida instalada="1.0.0" minima="1.4.0" onReintentar={onReintentar} />
      </SafeAreaProvider>,
    )
    fireEvent.press(screen.getByText('Volver a comprobar'))
    expect(onReintentar).toHaveBeenCalledTimes(1)
  })
})

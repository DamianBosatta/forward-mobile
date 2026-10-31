import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { ArrowLeftRight } from 'lucide-react-native'
import { useThemeStore } from '@/libs/theme'
import { Field, FilaDeAccion } from '../index'

beforeEach(() => {
  useThemeStore.setState({ mode: 'light' })
})

describe('Field prefijo (opt-in)', () => {
  it('sin prefijo no dibuja ningún "$" (render de siempre)', () => {
    render(<Field label="Monto" value="" onChangeText={() => {}} />)
    expect(screen.queryByText('$')).toBeNull()
  })

  it('con prefijo muestra el "$" junto al campo sin cambiar su etiqueta accesible', () => {
    render(<Field label="Monto" prefijo="$" value="" onChangeText={() => {}} alignRight />)
    expect(screen.getByText('$')).toBeTruthy()
    expect(screen.getByLabelText('Monto')).toBeTruthy()
  })
})

describe('FilaDeAccion agrupada (opt-in)', () => {
  const estiloPlano = (el: { props: { style?: unknown } }) => ([] as Record<string, unknown>[]).concat(el.props.style as never).flat().reduce((a, s) => ({ ...a, ...(s as object) }), {} as Record<string, unknown>)

  it('por defecto conserva borde y radio propios', () => {
    render(<FilaDeAccion icon={ArrowLeftRight} title="Fila" onPress={() => {}} />)
    const s = estiloPlano(screen.getByRole('button', { name: 'Fila' }))
    expect(s.borderWidth).toBe(1)
    expect(s.borderRadius).toBeGreaterThan(0)
  })

  it('agrupada va sin borde ni radio (la tarjeta la pone quien la agrupa)', () => {
    render(<FilaDeAccion icon={ArrowLeftRight} title="Fila" agrupada onPress={() => {}} />)
    const s = estiloPlano(screen.getByRole('button', { name: 'Fila' }))
    expect(s.borderWidth ?? 0).toBe(0)
    expect(s.borderRadius ?? 0).toBe(0)
  })
})

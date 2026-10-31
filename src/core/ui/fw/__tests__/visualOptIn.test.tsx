import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { ArrowLeftRight, ChevronRight } from 'lucide-react-native'
import { useThemeStore } from '@/libs/theme'
import { Button, Field, FilaDeAccion, TopBar } from '../index'

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

describe('TopBar textoDerecha (opt-in)', () => {
  it('por defecto no dibuja texto a la derecha del título', () => {
    render(<TopBar title="Nueva venta" leading={{ kind: 'atras', onPress: () => {} }} />)
    expect(screen.queryByText('Paso 1 de 3')).toBeNull()
    expect(screen.getByText('Nueva venta')).toBeTruthy()
  })

  it('con textoDerecha lo muestra junto al título', () => {
    render(<TopBar title="Nueva venta" textoDerecha="Paso 1 de 3" leading={{ kind: 'atras', onPress: () => {} }} />)
    expect(screen.getByText('Paso 1 de 3')).toBeTruthy()
    expect(screen.getByText('Nueva venta')).toBeTruthy()
  })
})

describe('Button iconoFinal (opt-in)', () => {
  it('por defecto no dibuja ícono final y conserva su nombre accesible', () => {
    render(<Button label="Continuar" onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(screen.queryByTestId('icono-final')).toBeNull()
  })

  it('con iconoFinal dibuja el ícono después del texto sin cambiar el nombre accesible', () => {
    render(<Button label="Continuar" iconoFinal={ChevronRight} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy()
    expect(screen.getAllByTestId('icono-final').length).toBeGreaterThan(0)
  })
})

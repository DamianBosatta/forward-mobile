import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { Lock } from 'lucide-react-native'
import { themeColors } from '@/libs/theme'
import { Button, FilaDeAjuste, IconoEnCuadro, MarcaDeCasilla, MarcaRadio, PasosNumerados, Segmented, TotalsRow } from '../index'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

afterEach(() => conTema('light'))

describe.each(TEMAS)('variantes FWD compartidas, tema %s', (tema) => {
  beforeEach(() => conTema(tema))
  const c = themeColors[tema]

  it('PasosNumerados: hecho teal con tilde, actual lima con número ink, pendiente con contorno', () => {
    render(<PasosNumerados nombres={['Uno', 'Dos', 'Tres']} paso={2} />)
    const circulo = (n: string) => {
      let el = screen.getByText(n).parent
      while (el && estilo(el).borderRadius !== 14) el = el.parent
      return el!
    }
    expect(estilo(circulo('2'))).toMatchObject({ backgroundColor: c.lime })
    expect(estilo(screen.getByText('2')).color).toBe(c.ink)
    expect(estilo(circulo('3'))).toMatchObject({ backgroundColor: 'transparent', borderWidth: 2 })
    expect(screen.queryByText('1')).toBeNull()
  })

  it('MarcaRadio: elegida en teal con tilde ink; sobre fila teal, disco ink', () => {
    const { rerender, toJSON } = render(<MarcaRadio elegido />)
    expect(estilo(toJSON() as never)).toMatchObject({ backgroundColor: c.teal })
    rerender(<MarcaRadio elegido sobreTeal />)
    expect(estilo(toJSON() as never)).toMatchObject({ backgroundColor: c.ink })
    rerender(<MarcaRadio elegido={false} />)
    expect(estilo(toJSON() as never)).toMatchObject({ backgroundColor: 'transparent', borderWidth: 2 })
  })

  it('MarcaDeCasilla: tildada en teal; sobreTeal en ink', () => {
    const { rerender } = render(<MarcaDeCasilla marcada />)
    expect(estilo(screen.getByTestId('casilla-caja', { includeHiddenElements: true }))).toMatchObject({ backgroundColor: c.teal })
    rerender(<MarcaDeCasilla marcada tamano={36} sobreTeal />)
    expect(estilo(screen.getByTestId('casilla-caja', { includeHiddenElements: true }))).toMatchObject({ backgroundColor: c.ink, width: 36 })
  })

  it('Segmented sobreTeal: píldora ink con el elegido en lima', () => {
    render(<Segmented tono="sobreTeal" accessibilityLabel="Unidad" options={[{ value: 'a', label: 'Bulto' }, { value: 'b', label: 'Pack' }]} value="a" onChange={jest.fn()} />)
    expect(estilo(screen.getByLabelText('Unidad'))).toMatchObject({ backgroundColor: c.ink })
    expect(estilo(screen.getByRole('radio', { name: 'Bulto' }))).toMatchObject({ backgroundColor: c.lime })
    expect(estilo(screen.getByText('Bulto')).color).toBe(c.ink)
  })

  it('FilaDeAjuste: el ícono va en un cuadro de 48 surfaceAlt', () => {
    render(<FilaDeAjuste icono={Lock} titulo="Clave" onPress={jest.fn()} />)
    const cuadros = screen.getByRole('button', { name: 'Clave' }).findAll((n) => estilo(n).width === 48)
    expect(cuadros.length).toBeGreaterThan(0)
    expect(estilo(cuadros[0])).toMatchObject({ width: 48, height: 48, backgroundColor: c.surfaceAlt })
  })

  it('IconoEnCuadro acepta otro fondo', () => {
    render(<IconoEnCuadro testID="cuadro" icono={Lock} fondo={c.surface} />)
    expect(estilo(screen.getByTestId('cuadro'))).toMatchObject({ backgroundColor: c.surface })
  })

  it('Button peligroContornoNeutro: contorno de peligro, texto normal y sin relleno', () => {
    render(<Button label="Cerrar sesión" variant="peligroContornoNeutro" size="lg" onPress={jest.fn()} />)
    expect(estilo(screen.getByRole('button', { name: 'Cerrar sesión' }))).toMatchObject({ backgroundColor: 'transparent', borderColor: c.dangerFill, borderWidth: 2, height: 64 })
    expect(estilo(screen.getByText('Cerrar sesión')).color).toBe(c.text)
  })

  it('TotalsRow sobreLima: todo en ink y el total con línea de 2 px', () => {
    render(<><TotalsRow tono="sobreLima" label="Cobrado" importe={100} /><TotalsRow tono="sobreLima" destacado label="Saldo" importe={50} /></>)
    expect(estilo(screen.getByText('Cobrado')).color).toBe(c.ink)
    const fila = estilo(screen.getByLabelText(/^Saldo:/))
    expect(fila).toMatchObject({ borderTopWidth: 2, borderTopColor: c.ink })
    expect(estilo(screen.getByText('Saldo')).color).toBe(c.ink)
  })

  it('TotalsRow acento: importe en accentText y sin línea', () => {
    render(<TotalsRow tono="acento" destacado label="Neto del mes" importe={55000} />)
    expect(estilo(screen.getByLabelText(/^Neto del mes:/)).borderTopWidth).toBeUndefined()
    expect(estilo(screen.getByText(/55\.000/)).color).toBe(c.accentText)
  })

  it('los velos de ink al 12 % y al 20 % son iguales en los dos temas', () => {
    expect(c.veilInk12).toBe('rgba(32, 30, 30, 0.12)')
    expect(c.veilInk20).toBe('rgba(32, 30, 30, 0.2)')
  })
})

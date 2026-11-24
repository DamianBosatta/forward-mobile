import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { conTema, estilo } from '@/core/ui/fw/__testing__/tema'
import { CabeceraColumna } from '../ColumnaTablero'

describe.each(['light', 'dark'] as const)('CabeceraColumna (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('MD-13/MD-25: the title stays on one line and shrinks to fit instead of breaking next to the count', () => {
    render(<CabeceraColumna id="noEntregado" items={[]} />)
    const titulo = screen.getByRole('header')
    expect(titulo.props.numberOfLines).toBe(1)
    expect(titulo.props.adjustsFontSizeToFit).toBe(true)
  })

  it('every column header has the same minimum height and a gap before the count', () => {
    render(<><CabeceraColumna id="noEntregado" items={[]} /><CabeceraColumna id="empacados" items={[]} /></>)
    const a = estilo(screen.getByTestId('cabecera-noEntregado'))
    const b = estilo(screen.getByTestId('cabecera-empacados'))
    expect(a.minHeight).toBeGreaterThan(0)
    expect(a.minHeight).toBe(b.minHeight)
    expect(a.gap).toBeGreaterThanOrEqual(12)
  })
})

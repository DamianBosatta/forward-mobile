import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { AvisoSoloWeb, SOLO_WEB, type AccionSoloWeb } from '../AvisoSoloWeb'

describe.each(['light', 'dark'] as const)('AvisoSoloWeb, tema %s', (modo) => {
  beforeEach(() => {
    useThemeStore.setState({ mode: modo })
  })

  it('dice que se hace en la web, sin botón ni acción', () => {
    render(<AvisoSoloWeb accion="abrirCaja" />)
    expect(screen.getByText(/Se hace en la web\. La caja se abre desde la web\./)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/Abrí/)).toBeNull()
  })

  it.each(Object.keys(SOLO_WEB) as AccionSoloWeb[])('%s: una frase propia que termina en "desde la web."', (accion) => {
    render(<AvisoSoloWeb accion={accion} />)
    expect(screen.getByText(new RegExp(SOLO_WEB[accion].replace(/[.]/g, '\.')))).toBeTruthy()
    expect(SOLO_WEB[accion]).toMatch(/desde la web\.$/)
  })

  it('usa el par de colores de info del tema', () => {
    render(<AvisoSoloWeb accion="rendicion" />)
    const fondo = themeColors[modo].chip.enCurso.bg
    expect(JSON.stringify(screen.getByTestId('aviso-solo-web').props.style)).toContain(fondo)
  })
})

import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { ProductoIdentidad } from '../ProductoIdentidad'
import { useThemeStore } from '@/libs/theme'

describe.each(['light', 'dark'] as const)('ProductoIdentidad (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('muestra marca, nombre y código', () => {
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca="Aromas del Sur" codigo="LAV-01" />)
    expect(screen.getByText('Esencia Lavanda')).toBeTruthy()
    expect(screen.getByText('Aromas del Sur')).toBeTruthy()
    expect(screen.getByText('LAV-01')).toBeTruthy()
  })

  it('sin marca no hay renglón de marca', () => {
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca={null} codigo="LAV-01" />)
    expect(screen.queryByText('Aromas del Sur')).toBeNull()
    expect(screen.getByText('Esencia Lavanda')).toBeTruthy()
  })

  it('sin código (vacío o nulo) no hay insignia', () => {
    render(<ProductoIdentidad nombre="Esencia Lavanda" marca="Aromas" codigo="  " />)
    expect(screen.queryByLabelText(/^Código/)).toBeNull()
  })
})

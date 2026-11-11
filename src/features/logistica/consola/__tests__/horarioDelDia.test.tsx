import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { conTema, TEMAS } from '@/core/ui/fw/__testing__/tema'
import { HorarioDelDia } from '../HorarioDelDia'

describe.each(TEMAS)('horario del día de la parada (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('muestra el texto de la API tal cual', () => {
    render(<HorarioDelDia horario={{ franjas: [], texto: 'Recibe 8 a 12 y 14 a 18 h' }} />)
    expect(screen.getByText('Recibe 8 a 12 y 14 a 18 h')).toBeTruthy()
  })

  it.each([[null], [undefined]])('sin horario (%s) no dibuja nada', (horario) => {
    const { toJSON } = render(<HorarioDelDia horario={horario} />)
    expect(toJSON()).toBeNull()
  })
})

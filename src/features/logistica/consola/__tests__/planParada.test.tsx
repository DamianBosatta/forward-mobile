import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { conTema, TEMAS } from '@/core/ui/fw/__testing__/tema'
import { PlanParada } from '../PlanParada'

describe.each(TEMAS)('plan de la parada (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('muestra la llegada estimada en hora argentina y la ventana', () => {
    render(<PlanParada parada={{ llegadaEstimadaEn: '2026-11-10T13:30:00Z', ventanaDesde: '09:00', ventanaHasta: '12:00', advertenciaVentana: 0 }} />)
    expect(screen.getByText('Llegada estimada 10:30 · ventana 09:00 a 12:00')).toBeTruthy()
    expect(screen.queryByText('Fuera de horario')).toBeNull()
  })

  it.each([
    [1, 'Fuera de horario'],
    [2, 'Sin horario cargado'],
    [3, 'Sin coordenadas'],
  ])('advertencia %s se dice con texto', (advertenciaVentana, texto) => {
    render(<PlanParada parada={{ llegadaEstimadaEn: '2026-11-10T13:30:00Z', advertenciaVentana }} />)
    expect(screen.getByText(texto)).toBeTruthy()
  })

  it('sin plan (nunca planificada) no muestra nada', () => {
    const { toJSON } = render(<PlanParada parada={{ advertenciaVentana: 0 }} />)
    expect(toJSON()).toBeNull()
  })
})

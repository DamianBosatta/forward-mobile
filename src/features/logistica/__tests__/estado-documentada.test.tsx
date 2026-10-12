import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { EstadoHojaRuta } from '@/libs/api-client/types'
import { RouteSelector } from '../components/RouteSelector'

describe('estado Documentada de la hoja de ruta', () => {
  it('el enum la reconoce como 5', () => {
    expect(EstadoHojaRuta.Documentada).toBe(5)
  })

  it('el selector de rutas la rotula DOCUMENTADA y no DESCONOCIDO', () => {
    render(
      <RouteSelector
        routes={[{ id: 'aaaaaaaa-1', estado: 5, fechaSalida: '2026-10-09T11:00:00Z', cantidadParadas: 3 } as never]}
        onSelect={jest.fn()}
      />,
    )
    expect(screen.getByText('DOCUMENTADA')).toBeTruthy()
    expect(screen.queryByText('DESCONOCIDO')).toBeNull()
  })
})

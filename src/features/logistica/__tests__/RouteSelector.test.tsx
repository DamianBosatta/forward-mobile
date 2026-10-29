import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { RouteSelector } from '../components/RouteSelector'

const ruta = (id: string, cantidadParadas: number) =>
  ({ id, estado: 1, fechaSalida: '2026-10-09T11:00:00Z', cantidadParadas }) as never

describe('RouteSelector: cantidad de entregas por viaje', () => {
  it('rotula "entregas" en plural y "entrega" en singular, nunca "paradas"', () => {
    render(<RouteSelector routes={[ruta('aaaaaaaa-1', 3), ruta('bbbbbbbb-2', 1)]} onSelect={jest.fn()} />)
    expect(screen.getByText('3 entregas')).toBeTruthy()
    expect(screen.getByText('1 entrega')).toBeTruthy()
    expect(screen.queryByText(/parada/i)).toBeNull()
  })
})

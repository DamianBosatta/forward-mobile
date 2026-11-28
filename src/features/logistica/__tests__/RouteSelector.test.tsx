import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { RouteSelector } from '../components/RouteSelector'

const ruta = (id: string, cantidadParadas: number, codigo = 'HR-0001') =>
  ({ id, codigo, estado: 1, fechaSalida: '2026-10-09T11:00:00Z', cantidadParadas }) as never

describe('RouteSelector: cantidad de entregas por viaje', () => {
  it('rotula "entregas" en plural y "entrega" en singular, nunca "paradas"', () => {
    render(<RouteSelector routes={[ruta('aaaaaaaa-1', 3), ruta('bbbbbbbb-2', 1)]} onSelect={jest.fn()} />)
    expect(screen.getByText('3 entregas')).toBeTruthy()
    expect(screen.getByText('1 entrega')).toBeTruthy()
    expect(screen.queryByText(/parada/i)).toBeNull()
  })
})

describe('RouteSelector: código del viaje', () => {
  it('prints the server codigo and never builds one from the id', () => {
    render(<RouteSelector routes={[ruta('aaaaaaaa-1', 3, 'HR-0142')]} onSelect={jest.fn()} />)
    expect(screen.getByText('HR-0142')).toBeTruthy()
    expect(screen.queryByText(/AAAAAAAA/)).toBeNull()
  })
})

describe('RouteSelector: entrada animada', () => {
  it('con muchos viajes los muestra todos (el retraso de entrada tiene tope)', () => {
    const rutas = Array.from({ length: 12 }, (_, i) => ruta(`id${String(i).padStart(6, '0')}-x`, i + 1))
    render(<RouteSelector routes={rutas} onSelect={jest.fn()} />)
    expect(screen.getByText('1 entrega')).toBeTruthy()
  })
})

import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { CobroEnEntrega } from '../CobroEnEntrega'

const props = { medios: [], mediosError: false, lineas: [], onLineas: jest.fn(), onSubiendo: jest.fn(), hoy: '07/11/2026' }

describe('CobroEnEntrega: título "Cobro"', () => {
  it('por defecto lo muestra (la entrega y reportar parada no cambian)', () => {
    render(<CobroEnEntrega {...props} />)
    expect(screen.getByText('Cobro')).toBeTruthy()
    expect(screen.getByRole('header', { name: '¿Cómo paga?' })).toBeTruthy()
  })

  it('sinTitulo lo oculta y deja solo "¿Cómo paga?"', () => {
    render(<CobroEnEntrega {...props} sinTitulo />)
    expect(screen.queryByText('Cobro')).toBeNull()
    expect(screen.getByRole('header', { name: '¿Cómo paga?' })).toBeTruthy()
  })

  it('sinTitulo conserva "A cobrar hoy" cuando hay importe', () => {
    render(<CobroEnEntrega {...props} sinTitulo aCobrar={500} />)
    expect(screen.getByLabelText('A cobrar hoy')).toBeTruthy()
  })
})

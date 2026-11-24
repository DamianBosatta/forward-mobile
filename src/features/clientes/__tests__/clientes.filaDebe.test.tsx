import React from 'react'
import { render, screen, within } from '@testing-library/react-native'
import { ClienteCard } from '../components/ClienteCard'
import { clienteDeLista } from '../__testing__/ayuda'

const $ = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

describe.each(['fila', 'cartera'] as const)('ClienteCard %s: el importe dice qué es (MP-1)', variante => {
  it('con deuda dice "Debe" junto al importe y lo repite en la etiqueta de accesibilidad', () => {
    render(<ClienteCard cliente={clienteDeLista({ saldoAmount: 12500 })} variante={variante} onPress={() => {}} />)

    const saldo = screen.getByTestId('saldo-cliente')
    expect(within(saldo).getByText('Debe')).toBeTruthy()
    expect(within(saldo).getByText($(12500))).toBeTruthy()
    expect(screen.getByRole('button', { name: /debe \$ 12\.500,00/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /saldo \$/ })).toBeNull()
  })

  it('sin deuda sigue diciendo "Sin deuda" y no dice "Debe"', () => {
    render(<ClienteCard cliente={clienteDeLista({ saldoAmount: 0 })} variante={variante} onPress={() => {}} />)

    expect(screen.getByText('Sin deuda')).toBeTruthy()
    expect(screen.queryByText('Debe')).toBeNull()
  })

  it('si el servidor no deja ver el saldo no hay "Debe" ni importe', () => {
    render(<ClienteCard cliente={clienteDeLista({ puedeVerSaldo: false, saldoAmount: 12500 })} variante={variante} onPress={() => {}} />)

    expect(screen.queryByText('Debe')).toBeNull()
    expect(screen.queryByText($(12500))).toBeNull()
    expect(screen.queryByRole('button', { name: /debe/i })).toBeNull()
  })

  it('el botón del teléfono se llama "Llamar"', () => {
    render(<ClienteCard cliente={clienteDeLista()} variante={variante} onPress={() => {}} />)

    expect(screen.getByLabelText('Llamar')).toBeTruthy()
  })
})

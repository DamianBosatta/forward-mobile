import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { ProductoCatalogoCard } from '../components/ProductoCatalogoCard'
import { producto } from '../__testing__/producto'

const noop = () => {}
const pintar = (cantidad: number, extra: Record<string, unknown> = {}) =>
  render(<ProductoCatalogoCard producto={producto(extra)} cantidad={cantidad} verCantidades={false} onAgregar={noop} onSumar={noop} onRestar={noop} />)

describe('ProductoCatalogoCard (CalleCatalogo)', () => {
  it('lo que ya está en el carrito se marca con el fondo y el borde de la marca; lo que no, queda liso', () => {
    const r = pintar(6)
    expect(screen.getByTestId('producto-p1')).toHaveStyle({ backgroundColor: '#E0F8F3', borderColor: '#00C29E' })
    r.unmount()
    pintar(0)
    expect(screen.getByTestId('producto-p1')).toHaveStyle({ backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' })
  })

  it('con foto la muestra; sin foto deja el ícono de producto', () => {
    const r = pintar(0, { imageUrl: 'https://img.test/a.png' })
    expect(screen.UNSAFE_getByType(require('react-native').Image).props.source).toEqual({ uri: 'https://img.test/a.png' })
    r.unmount()
    pintar(0, { imageUrl: null })
    expect(screen.UNSAFE_queryByType(require('react-native').Image)).toBeNull()
  })
})

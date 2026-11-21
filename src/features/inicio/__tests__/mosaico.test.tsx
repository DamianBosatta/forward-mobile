import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { useThemeStore } from '@/libs/theme'
import { MosaicoDeInicio } from '../components/MosaicoDeInicio'

describe.each(['light', 'dark'] as const)('MosaicoDeInicio (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('la etiqueta puede pasar a dos líneas y la cifra sigue en una', () => {
    render(<MosaicoDeInicio etiqueta="Me deben los clientes" valor="$ 48.920.300,00" />)
    expect(screen.getByText('Me deben los clientes').props.numberOfLines).toBe(2)
    expect(screen.getByText('$ 48.920.300,00').props.numberOfLines).toBe(1)
  })
})

import React from 'react'
import { Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { Fab } from '../Fab'
import { SobreBarraInferiorProvider, usePaddingFinalDePantalla } from '../insetInferior'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}))

function Probe() {
  return <Text testID="pad">{usePaddingFinalDePantalla()}</Text>
}

describe.each(TEMAS)('barra inferior del sistema (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('Fab: queda sobre la barra del sistema (24 + inset)', () => {
    render(<Fab accessibilityLabel="Nueva venta" onPress={() => {}} />)
    expect(estilo(screen.getByRole('button')).bottom).toBe(24 + 34)
  })

  it('Fab: sobre una BottomBar no suma la barra del sistema', () => {
    render(<SobreBarraInferiorProvider><Fab accessibilityLabel="Nueva venta" onPress={() => {}} /></SobreBarraInferiorProvider>)
    expect(estilo(screen.getByRole('button')).bottom).toBe(24)
  })

  it('el relleno final de un scroll suma el inset; sobre una BottomBar, solo la base', () => {
    const { unmount } = render(<Probe />)
    expect(screen.getByTestId('pad').props.children).toBe(16 + 34)
    unmount()
    render(<SobreBarraInferiorProvider><Probe /></SobreBarraInferiorProvider>)
    expect(screen.getByTestId('pad').props.children).toBe(16)
  })
})

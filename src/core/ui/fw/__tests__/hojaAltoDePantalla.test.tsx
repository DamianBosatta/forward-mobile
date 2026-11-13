/**
 * BottomSheet no pasa del alto disponible (pantalla menos barra de estado y un margen): en un teléfono bajo
 * o en tablet apaisada el contenido scrollea adentro en vez de meterse bajo la barra de estado.
 */
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { space } from '@/libs/theme'
import { BottomSheet } from '..'
import { TEMAS, conTema } from '../__testing__/tema'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
const mockResp = jest.fn()
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => mockResp() }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const INSET_TOP = 24
const INSET_BOTTOM = 34
const panelDe = () => StyleSheet.flatten(screen.getByLabelText('Hoja').props.style)

describe.each(TEMAS)('BottomSheet alto de pantalla (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it.each([600, 1000])('teléfono de %i de alto: el panel no pasa de alto - barra de estado - margen', (height) => {
    mockDims.mockReturnValue({ width: 360, height, scale: 2, fontScale: 1 })
    mockResp.mockReturnValue({ width: 360, height, isSmall: false, isMedium: true, isLarge: false, scale: (n: number) => n })
    render(<BottomSheet visible onClose={jest.fn()} accessibilityLabel="Hoja"><Text>x</Text></BottomSheet>)
    expect(panelDe().maxHeight).toBe(height - INSET_TOP - space[4])
  })

  it.each([600, 1000])('tablet de %i de alto: el diálogo centrado también queda acotado', (height) => {
    mockDims.mockReturnValue({ width: 834, height, scale: 2, fontScale: 1 })
    mockResp.mockReturnValue({ width: 834, height, isSmall: false, isMedium: false, isLarge: true, scale: (n: number) => n })
    render(<BottomSheet visible onClose={jest.fn()} accessibilityLabel="Hoja"><Text>x</Text></BottomSheet>)
    expect(panelDe().maxHeight).toBe(height - INSET_TOP - space[6] * 2)
  })
})

describe.each(TEMAS)('BottomSheet y la barra del sistema (%s)', (tema) => {
  beforeEach(() => {
    conTema(tema)
    mockDims.mockReturnValue({ width: 360, height: 700, scale: 2, fontScale: 1 })
    mockResp.mockReturnValue({ width: 360, height: 700, isSmall: false, isMedium: true, isLarge: false, scale: (n: number) => n })
  })

  it('con el teclado cerrado el pie de la hoja queda sobre la barra de navegación (insets.bottom, una sola vez)', () => {
    render(<BottomSheet visible onClose={jest.fn()} accessibilityLabel="Hoja"><Text>x</Text></BottomSheet>)
    expect(panelDe().paddingBottom).toBe(space[6] + INSET_BOTTOM)
  })
})

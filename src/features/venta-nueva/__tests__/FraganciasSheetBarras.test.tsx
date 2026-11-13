/**
 * "Elegir fragancias" en un teléfono bajo: la hoja no pasa bajo la barra de estado (arriba) ni sus botones
 * bajo la barra de navegación (abajo). El tope y el relleno los pone BottomSheet; la hoja no suma insets propios.
 */
import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { space } from '@/libs/theme'
import { TEMAS, conTema } from '@/core/ui/fw/__testing__/tema'
import { FraganciasSheet } from '../components/FraganciasSheet'
import { producto } from '../__testing__/producto'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn().mockResolvedValue([]) },
}))
const mockPadre = producto({ id: 'pf', nombre: 'Saphirus Aerosol', esPadreDeVariantes: true })
jest.mock('../hooks/useCatalogoVenta', () => ({ useCatalogoVenta: () => ({ productos: [mockPadre], isLoading: false }) }))

describe.each(TEMAS)('FraganciasSheet y las barras del sistema (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it.each([600, 1000])('con %i de alto la hoja queda entre la barra de estado y la de navegación', (height) => {
    mockDims.mockReturnValue({ width: 360, height, scale: 2, fontScale: 1 })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FraganciasSheet padreId="pf" onClose={jest.fn()} />
      </QueryClientProvider>,
    )
    const panel = StyleSheet.flatten(screen.getByLabelText('Elegir fragancias').props.style)
    expect(panel.maxHeight).toBeLessThanOrEqual(height - 24 - space[4])
    expect(panel.paddingBottom).toBe(space[6] + 34)
  })
})

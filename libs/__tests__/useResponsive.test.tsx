/**
 * Bloque 9A (PR 0.2b) — puntos de corte del plan §8: teléfono < 600,
 * tablet vertical 600–899, tablet horizontal ≥ 900. Se manejan con el ancho
 * real de la ventana (useWindowDimensions), no con el tipo de dispositivo.
 */
import { renderHook } from '@testing-library/react-native'
import { useResponsive } from '../useResponsive'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims(),
}))

const conAncho = (width: number) => {
  mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 })
  return renderHook(() => useResponsive()).result.current
}

describe('useResponsive — puntos de corte del plan §8', () => {
  it.each([
    [320, 'phone'],
    [599, 'phone'],
    [600, 'tabletPortrait'],
    [899, 'tabletPortrait'],
    [900, 'tabletLandscape'],
    [1194, 'tabletLandscape'],
  ])('con %i px de ancho es %s', (ancho, esperado) => {
    expect(conAncho(ancho).formFactor).toBe(esperado)
  })

  it('isTablet arranca en 600 y isTabletLandscape en 900', () => {
    expect(conAncho(599)).toMatchObject({ isTablet: false, isTabletLandscape: false })
    expect(conAncho(600)).toMatchObject({ isTablet: true, isTabletLandscape: false })
    expect(conAncho(900)).toMatchObject({ isTablet: true, isTabletLandscape: true })
  })

  it('isLarge conserva su significado (≥ 600) para los consumidores existentes', () => {
    expect(conAncho(599).isLarge).toBe(false)
    expect(conAncho(600).isLarge).toBe(true)
  })

  it('reacciona al girar la tablet (cambia el ancho sin desmontar)', () => {
    mockDims.mockReturnValue({ width: 834, height: 1194, scale: 2, fontScale: 1 })
    const { result, rerender } = renderHook(() => useResponsive())
    expect(result.current.formFactor).toBe('tabletPortrait')

    mockDims.mockReturnValue({ width: 1194, height: 834, scale: 2, fontScale: 1 })
    rerender({})
    expect(result.current.formFactor).toBe('tabletLandscape')
  })
})

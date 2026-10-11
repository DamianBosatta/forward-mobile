/**
 * Bloque 9A (PR 0.2b) — base responsive del plan §8, probada por ancho de
 * ventana real (useWindowDimensions mockeado, useResponsive verdadero).
 */
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { render, renderHook, screen } from '@testing-library/react-native'
import { TwoPane, TWO_PANE_LIST_WIDTH, FormContainer, FORM_MAX_WIDTH, useMenuLeading } from '..'

const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims(),
}))

const mockDispatch = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  DrawerActions: { openDrawer: () => ({ type: 'OPEN_DRAWER' }) },
}))

const TELEFONO = 390
const TABLET_VERTICAL = 834
const TABLET_HORIZONTAL = 1194

const conAncho = (width: number) => mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 })

const lista = <Text>Lista de ventas</Text>
const detalle = <Text>Venta A00418</Text>

describe('TwoPane', () => {
  it.each([TELEFONO, TABLET_VERTICAL])('con %i px y sin nada elegido muestra solo la lista', (ancho) => {
    conAncho(ancho)
    render(<TwoPane list={lista} detail={null} />)
    expect(screen.getByText('Lista de ventas')).toBeTruthy()
    expect(screen.queryByText('Venta A00418')).toBeNull()
  })

  it.each([TELEFONO, TABLET_VERTICAL])('con %i px y un documento elegido muestra solo el detalle', (ancho) => {
    conAncho(ancho)
    render(<TwoPane list={lista} detail={detalle} />)
    expect(screen.getByText('Venta A00418')).toBeTruthy()
    expect(screen.queryByText('Lista de ventas')).toBeNull()
  })

  it('en tablet horizontal muestra lista y detalle lado a lado', () => {
    conAncho(TABLET_HORIZONTAL)
    render(<TwoPane list={lista} detail={detalle} />)
    expect(screen.getByText('Lista de ventas')).toBeTruthy()
    expect(screen.getByText('Venta A00418')).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('two-pane-list').props.style).width).toBe(TWO_PANE_LIST_WIDTH)
  })

  it('en tablet horizontal sin nada elegido deja la lista y el aviso vacío a la derecha', () => {
    conAncho(TABLET_HORIZONTAL)
    render(<TwoPane list={lista} detail={null} emptyDetail={<Text>Elegí una venta</Text>} />)
    expect(screen.getByText('Lista de ventas')).toBeTruthy()
    expect(screen.getByText('Elegí una venta')).toBeTruthy()
  })
})

describe('FormContainer', () => {
  const anchoMaximo = () => StyleSheet.flatten(screen.getByTestId('form-container').props.style)

  it('en teléfono ocupa todo el ancho', () => {
    conAncho(TELEFONO)
    render(<FormContainer><Text>Campo</Text></FormContainer>)
    expect(anchoMaximo().maxWidth).toBeUndefined()
  })

  it.each([600, TABLET_VERTICAL, 899])('con %i px se centra con ancho máximo', (ancho) => {
    conAncho(ancho)
    render(<FormContainer><Text>Campo</Text></FormContainer>)
    expect(anchoMaximo()).toMatchObject({ maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' })
  })
})

describe('useMenuLeading — el menú se abre con botón solo en teléfono', () => {
  beforeEach(() => mockDispatch.mockClear())

  it('en teléfono da un botón de menú que abre el menú lateral', () => {
    conAncho(TELEFONO)
    const leading = renderHook(() => useMenuLeading()).result.current
    expect(leading?.kind).toBe('menu')
    leading?.onPress()
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'OPEN_DRAWER' })
  })

  it.each([600, TABLET_HORIZONTAL])('con %i px no hay botón: el menú está fijo', (ancho) => {
    conAncho(ancho)
    expect(renderHook(() => useMenuLeading()).result.current).toBeUndefined()
  })
})

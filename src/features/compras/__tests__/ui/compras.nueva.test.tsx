import React from 'react'
import { render } from '@testing-library/react-native'
import NuevaCompraScreen from '../../../../../app/(tabs)/compras/nueva'
import { useCompraForm } from '../../hooks/useCompraForm'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ edit: undefined }),
  useNavigation: () => ({ dispatch: jest.fn() })
}))

jest.mock('@react-navigation/native', () => ({
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: jest.fn()
}))

jest.mock('../../hooks/useCompraForm', () => ({
  useCompraForm: jest.fn()
}))

jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))

jest.mock('@/core/ui', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    ForwardLogo: () => <View />
  }
})

describe('NuevaCompraScreen UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('debe renderizar el titulo correctamente', () => {
    ;(useCompraForm as jest.Mock).mockReturnValue({
      loadingEdit: false,
      proveedorSelected: null,
      depositoSelected: null,
      detalles: [],
      estadoOrden: 'Presupuesto',
      proveedoresFiltrados: [],
      productosFiltrados: [],
      depositos: [],
      subtotal: 0,
      total: 0,
      canSubmit: false,
      resetFormState: jest.fn(),
      bumpFocusKey: jest.fn(),
      queryClient: { removeQueries: jest.fn() },
      comprasKeys: { detail: jest.fn() }
    })

    const { getByText } = render(<NuevaCompraScreen />)

    expect(getByText('Nueva Compra')).toBeTruthy()
    expect(getByText('Flujo Inicial de la Orden')).toBeTruthy()
  })
})

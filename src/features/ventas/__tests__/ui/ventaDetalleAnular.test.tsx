import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { VentaDetalle } from '../../../../../app/(tabs)/ventas/[id]'

// Anular desde el detalle: en el panel de la tablet hay que cerrar el panel (onVolver);
// en la ruta del teléfono se vuelve a la lista con router.replace.
const mockReplace = jest.fn()
const mockAnular = jest.fn()
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'v1' }),
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }) }))
jest.mock('@/libs/api-client', () => ({
  useVenta: () => ({
    data: { venta: { id: 'v1', version: 3, estado: 'Confirmada', activo: true, tipoOperacion: 2, clienteId: 'c1', clienteNombre: 'Carlos' }, detalles: [], bultos: [] },
    isLoading: false, refetch: jest.fn(),
  }),
  useConvertirPresupuesto: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAnularVenta: () => ({ mutateAsync: mockAnular, isPending: false }),
  useSocio: () => ({ data: undefined, isLoading: false }),
  getNotaEntregaUrl: jest.fn(),
  getEtiquetasUrl: jest.fn(),
}))
jest.mock('@/core/auth/RequirePermission', () => ({
  RequirePermission: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermissions: () => ({ canUpdate: () => true }),
}))
jest.mock('@/core/ui', () => {
  const { View } = require('react-native')
  const Pasa = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>
  return { ForwardLogo: Pasa, RequirePermission: Pasa, GlassCard: Pasa, AuroraGlow: Pasa }
})
jest.mock('@/core/ui/ConfirmModal', () => {
  const { Pressable, Text } = require('react-native')
  return { ConfirmModal: ({ onConfirm }: { onConfirm: () => void }) => <Pressable accessibilityRole="button" onPress={onConfirm}><Text>Sí, anular</Text></Pressable> }
})
jest.mock('@/features/ventas/components/AuthorizationModal', () => ({ AuthorizationModal: () => null }))
jest.mock('moti', () => ({
  MotiView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('expo-blur', () => {
  const { View } = require('react-native')
  return { BlurView: ({ children, style }: { children: React.ReactNode; style?: object }) => <View style={style}>{children}</View> }
})
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

async function anular() {
  await userEvent.press(screen.getByText('Anular'))
  await userEvent.press(screen.getByText('Sí, anular'))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAnular.mockResolvedValue(undefined)
})

describe('anular desde el detalle de venta', () => {
  it('embebido en la tablet, después de anular cierra el panel y no navega', async () => {
    const onVolver = jest.fn()
    render(<VentaDetalle id="v1" onVolver={onVolver} />)
    await anular()
    await waitFor(() => expect(onVolver).toHaveBeenCalledTimes(1))
    expect(mockAnular).toHaveBeenCalledWith({ id: 'v1', version: 3, motivoAnulacion: 'Cancelación manual' })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('en la ruta del teléfono, después de anular vuelve a la lista', async () => {
    render(<VentaDetalle id="v1" />)
    await anular()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/ventas'))
  })

  it('embebido no suma el margen de la barra de estado arriba; en la ruta sí', () => {
    const embebido = render(<VentaDetalle id="v1" onVolver={jest.fn()} />)
    expect(JSON.stringify(embebido.toJSON())).not.toContain('"paddingTop":50')
    embebido.unmount()
    const ruta = render(<VentaDetalle id="v1" />)
    expect(JSON.stringify(ruta.toJSON())).toContain('"paddingTop":50')
  })
})

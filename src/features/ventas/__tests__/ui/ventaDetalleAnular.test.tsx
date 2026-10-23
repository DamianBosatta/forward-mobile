import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { VentaDetalle } from '../../../../../app/(tabs)/ventas/[id]'
import { useAuthStore } from '@/features/auth/store/auth.store'

// Anular desde el detalle: en el panel de la tablet hay que cerrar el panel (onVolver);
// en la ruta del teléfono se vuelve a la lista con router.replace.
const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockEstado: string | number = 'Confirmada'
const mockAnular = jest.fn()
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'v1' }),
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }) }))
jest.mock('@/libs/api-client', () => ({
  useVenta: () => ({
    data: { venta: { id: 'v1', version: 3, estado: mockEstado, activo: true, tipoOperacion: 2, clienteId: 'c1', clienteNombre: 'Carlos', codigoPedido: 'A00421', totalAmount: 178320 }, detalles: [], bultos: [] },
    isLoading: false, refetch: jest.fn(),
  }),
  useConvertirPresupuesto: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAnularVenta: () => ({ mutateAsync: mockAnular, isPending: false }),
  useSocio: () => ({ data: { direccion: 'Brandsen 3314' }, isLoading: false }),
  getNotaEntregaUrl: jest.fn(),
  getEtiquetasUrl: jest.fn(),
}))
jest.mock('@/core/auth/RequirePermission', () => ({
  RequirePermission: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermissions: () => ({ canDo: () => true }),
}))
jest.mock('@/core/ui', () => {
  const { View } = require('react-native')
  const Pasa = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>
  return { ForwardLogo: Pasa, RequirePermission: Pasa, GlassCard: Pasa, AuroraGlow: Pasa }
})
jest.mock('moti', () => ({
  MotiView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('expo-blur', () => {
  const { View } = require('react-native')
  return { BlurView: ({ children, style }: { children: React.ReactNode; style?: object }) => <View style={style}>{children}</View> }
})
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

// Anular = la confirmación de la web, sin pedir motivo.
async function anular() {
  await userEvent.press(screen.getByText('Anular'))
  expect(await screen.findByText('¿Deseas anular esta venta? Se liberará el stock reservado.')).toBeTruthy()
  await userEvent.press(screen.getByRole('button', { name: 'Anular Venta' }))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockEstado = 'Confirmada'
  mockAnular.mockResolvedValue(undefined)
})

describe('agendar desde el detalle de venta (PR 5.3b)', () => {
  it('abre el calendario con el título y la descripción de la venta, identificada por la dirección', async () => {
    render(<VentaDetalle id="v1" />)
    await userEvent.press(screen.getByLabelText('Agendar'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/calendario',
      params: { titulo: 'Seguir el pedido A00421 · Brandsen 3314', descripcion: 'Pedido A00421 · Carlos · $ 178.320,00', origen: 'A00421', ventaId: 'v1', nonce: expect.any(String) },
    })
  })
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

describe('anular según la web (PermMatriz "2 · Ventas")', () => {
  it('no pide motivo y "Cancelar" cierra sin anular', async () => {
    render(<VentaDetalle id="v1" />)
    await userEvent.press(screen.getByText('Anular'))
    expect(await screen.findByText('¿Deseas anular esta venta? Se liberará el stock reservado.')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(mockAnular).not.toHaveBeenCalled()
  })

  it('en ruta queda deshabilitado y dice por qué', () => {
    mockEstado = 'EnRuta'
    render(<VentaDetalle id="v1" />)
    expect(screen.getByText('No se puede anular: el pedido está en ruta.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeDisabled()
  })

  it('rechazada no se anula ni se edita', () => {
    mockEstado = 11
    render(<VentaDetalle id="v1" />)
    expect(screen.queryByText('Anular')).toBeNull()
    expect(screen.queryByText('Modificar')).toBeNull()
  })

  it('por autorizar no se modifica (la web edita solo Pendiente o Confirmada)', () => {
    mockEstado = 9
    render(<VentaDetalle id="v1" />)
    expect(screen.queryByText('Modificar')).toBeNull()
  })
})

describe('autorizar desde el detalle de venta', () => {
  it('con CAP_AUTORIZAR_VENTA lleva al detalle para autorizar (motivos, razón y costos con permiso)', async () => {
    mockEstado = 9
    useAuthStore.setState({ user: { id: 'u1', roles: [], permissions: [{ module: 'CAP_AUTORIZAR_VENTA', canRead: true }] } } as never)
    render(<VentaDetalle id="v1" />)
    await userEvent.press(screen.getByText('AUTORIZAR PEDIDO'))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/autorizaciones/v1')
  })
})

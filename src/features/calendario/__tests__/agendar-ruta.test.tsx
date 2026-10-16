import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
import CalendarioRoute from '../../../../app/(tabs)/calendario/index'

jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: () => Promise.resolve([]), post: jest.fn() },
}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ push: jest.fn() }) }))

const venta = { titulo: 'Seguir el pedido A00421', descripcion: 'Pedido A00421', origen: 'A00421' }
const tree = () => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <CalendarioRoute />
  </QueryClientProvider>
)

describe('Agendar desde una venta (ruta del calendario)', () => {
  it('agendar dos veces desde la misma venta vuelve a abrir la hoja con la precarga', async () => {
    mockParams = { ...venta, nonce: '1' }
    const { rerender } = render(tree())
    expect((await screen.findByLabelText('Título')).props.value).toBe('Seguir el pedido A00421')
    await userEvent.press(screen.getByLabelText('Cerrar', { includeHiddenElements: true }))
    expect(screen.queryByLabelText('Título')).toBeNull()
    // Segundo "Agendar" de la misma venta: la pantalla del Drawer sigue montada, solo cambia el nonce.
    mockParams = { ...venta, nonce: '2' }
    rerender(tree())
    expect((await screen.findByLabelText('Título')).props.value).toBe('Seguir el pedido A00421')
  })
})

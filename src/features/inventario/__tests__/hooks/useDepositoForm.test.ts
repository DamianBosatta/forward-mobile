import { renderHook, act } from '@testing-library/react-native'
import { useDepositoForm } from '../../hooks/useDepositoForm'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Queries from '../../api/queries'

// Mocks
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'Medium', Light: 'Light' },
  NotificationFeedbackType: { Success: 'Success' }
}))

jest.mock('../../api/queries', () => ({
  useDepositos: jest.fn(),
  useCreateDeposito: jest.fn(),
  useUpdateDeposito: jest.fn()
}))

describe('useDepositoForm Hook', () => {
  const mockRouter = { replace: jest.fn() }
  const mockCreateMutate = jest.fn()
  const mockUpdateMutate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: undefined })
    
    ;(Queries.useDepositos as jest.Mock).mockReturnValue({ data: [] })
    ;(Queries.useCreateDeposito as jest.Mock).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false
    })
    ;(Queries.useUpdateDeposito as jest.Mock).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false
    })
  })

  it('debe inicializar vacío para crear un nuevo depósito', () => {
    const { result } = renderHook(() => useDepositoForm())

    expect(result.current.isEdit).toBe(false)
    expect(result.current.nombre).toBe('')
    expect(result.current.direccion).toBe('')
  })

  it('debe cargar datos si estamos en modo edición', () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1' })
    ;(Queries.useDepositos as jest.Mock).mockReturnValue({
      data: [{ id: '1', nombre: 'Central', direccion: 'Dir', activo: true }]
    })

    const { result } = renderHook(() => useDepositoForm())

    expect(result.current.isEdit).toBe(true)
    expect(result.current.nombre).toBe('Central')
    expect(result.current.direccion).toBe('Dir')
  })

  it('no debe hacer submit si el nombre está vacío', async () => {
    const { result } = renderHook(() => useDepositoForm())

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(mockCreateMutate).not.toHaveBeenCalled()
  })

  it('debe llamar a mutate create cuando se guarden datos válidos', async () => {
    const { result } = renderHook(() => useDepositoForm())

    act(() => {
      result.current.setNombre('Depósito Sur')
      result.current.setDireccion('Av Siempre Viva')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { nombre: 'Depósito Sur', direccion: 'Av Siempre Viva' },
      expect.any(Object)
    )
  })

  it('debe limpiar el formulario con resetForm', () => {
    const { result } = renderHook(() => useDepositoForm())

    act(() => {
      result.current.setNombre('Test')
      result.current.setDireccion('Dir')
      result.current.resetForm()
    })

    expect(result.current.nombre).toBe('')
    expect(result.current.direccion).toBe('')
  })
})

import React from 'react'
import { render, screen } from '@testing-library/react-native'

const mockLogError = jest.fn()
jest.mock('@/src/core/utils/logger', () => ({ logger: { error: (...a: unknown[]) => mockLogError(...a), warn: jest.fn(), info: jest.fn(), log: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('moti', () => ({ MotiView: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))

import { GlobalErrorBoundary } from '../GlobalErrorBoundary'

beforeEach(() => mockLogError.mockClear())

describe('GlobalErrorBoundary (OPS-02)', () => {
  it('manda al logger el Error real (no cuatro textos sueltos), así Sentry lo agrupa como excepción', () => {
    const error = new Error('boom interno')
    render(<GlobalErrorBoundary error={error} retry={jest.fn()} />)
    expect(mockLogError).toHaveBeenCalledTimes(1)
    expect(mockLogError.mock.calls[0]).toContain(error)
    expect(mockLogError.mock.calls[0].every((a: unknown) => typeof a !== 'string' || !a.includes('boom interno'))).toBe(true)
  })

  it('ME-R7-1: usa el logo vigente (LogoForward), el mismo del login y la barra', () => {
    render(<GlobalErrorBoundary error={new Error('x')} retry={jest.fn()} />)
    expect(screen.getByTestId('logo-fwd', { includeHiddenElements: true })).toBeTruthy()
  })

  it('no le muestra a la persona el texto crudo del error', () => {
    render(<GlobalErrorBoundary error={new Error('SELECT * FROM secreto at stack')} retry={jest.fn()} />)
    expect(screen.queryByText(/SELECT/)).toBeNull()
    expect(screen.getByText('Algo salió mal')).toBeTruthy()
  })

  it('OPS-R4B-02: tampoco muestra el nombre de la clase del error, solo el texto fijo', () => {
    render(<GlobalErrorBoundary error={new TypeError('x')} retry={jest.fn()} />)
    expect(screen.queryByText('TypeError')).toBeNull()
    expect(screen.getByText('El detalle quedó registrado para el equipo.')).toBeTruthy()
  })
})

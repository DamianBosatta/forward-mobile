/**
 * El número de avisos sin leer sale del servidor (`noLeidas`, independiente del límite) y se
 * refresca solo: cada minuto mientras la app está abierta y apenas vuelve al frente. No hay push
 * (el servidor no registra tokens de dispositivo), así que volver a la app es el momento de mirar.
 */
import React from 'react'
import { AppState, Text } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react-native'
import { AvisosAlVolver, useAvisosNoLeidos } from '../noLeidos'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (url: string) => mockGet(url) } }))
let mockAutenticado = true
jest.mock('@/features/auth/store/auth.store', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) => sel({ isAuthenticated: mockAutenticado }),
}))

function Badge() {
  const n = useAvisosNoLeidos()
  return <Text>{`sin leer: ${n}`}</Text>
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AvisosAlVolver /><Badge /></QueryClientProvider>)
}

let alCambiar: ((estado: string) => void) | undefined
beforeEach(() => {
  jest.clearAllMocks()
  mockAutenticado = true
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (e: string) => void) => {
    alCambiar = cb
    return { remove: jest.fn() }
  }) as never)
})
afterEach(() => jest.restoreAllMocks())

describe('avisos sin leer', () => {
  it('pide una sola fila de las no leídas y muestra el total del servidor', async () => {
    mockGet.mockResolvedValue({ items: [], noLeidas: 7, hayMas: true })
    pintar()
    expect(await screen.findByText('sin leer: 7')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Notificaciones?SoloNoLeidas=true&Limite=1')
  })

  it('al volver la app al frente vuelve a preguntar', async () => {
    mockGet.mockResolvedValueOnce({ items: [], noLeidas: 1, hayMas: false })
    pintar()
    await screen.findByText('sin leer: 1')
    mockGet.mockResolvedValueOnce({ items: [], noLeidas: 4, hayMas: false })
    await act(async () => alCambiar?.('active'))
    expect(await screen.findByText('sin leer: 4')).toBeTruthy()
  })

  it('pasar a segundo plano no pide nada', async () => {
    mockGet.mockResolvedValue({ items: [], noLeidas: 1, hayMas: false })
    pintar()
    await screen.findByText('sin leer: 1')
    await act(async () => alCambiar?.('background'))
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('sin sesión no pregunta y el número es cero', async () => {
    mockAutenticado = false
    pintar()
    expect(screen.getByText('sin leer: 0')).toBeTruthy()
    await act(async () => alCambiar?.('active'))
    expect(mockGet).not.toHaveBeenCalled()
  })
})

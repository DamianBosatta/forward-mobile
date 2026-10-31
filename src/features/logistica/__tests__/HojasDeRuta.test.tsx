import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
import { crearQueryClient } from '@/core/query/queryClient'
import { HojasDeRutaScreen } from '../components/HojasDeRutaScreen'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))

const HOJA = (id: string, chofer: string, patente: string, paradas: number, estado = 2) =>
  ({ id, choferNombre: chofer, vehiculoPatente: patente, estado, fechaSalida: '2026-10-30T11:00:00Z', cantidadParadas: paradas, distanciaTotalMetros: 0, rutaCalculada: false })

const pintar = () => render(<QueryClientProvider client={crearQueryClient({ retry: false })}><HojasDeRutaScreen /></QueryClientProvider>)

beforeEach(() => jest.clearAllMocks())

describe('Hojas de ruta de la empresa', () => {
  it('lista chofer, vehículo, entregas y estado de cada hoja', async () => {
    mockGet.mockResolvedValue([HOJA('aaaaaaaa-1111', 'Juan Pérez', 'AB123CD', 4), HOJA('bbbbbbbb-2222', 'Ana Gómez', 'XY987ZT', 1)])
    pintar()
    expect(await screen.findByText('Juan Pérez')).toBeTruthy()
    expect(screen.getByText('AB123CD')).toBeTruthy()
    expect(screen.getByText('4 entregas')).toBeTruthy()
    expect(screen.getByText('1 entrega')).toBeTruthy()
    expect(screen.getByText('Hoja #AAAAAAAA')).toBeTruthy()
    expect(screen.getAllByLabelText('Estado: En curso')).toHaveLength(2)
  })

  it('el filtro por defecto es "En curso": pide estado=2', async () => {
    mockGet.mockResolvedValue([])
    pintar()
    await screen.findByText('No hay hojas de ruta en curso.')
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta?estado=2')
    expect(screen.getByLabelText('En curso').props.accessibilityState.selected).toBe(true)
  })

  it('sin hojas muestra el estado vacío', async () => {
    mockGet.mockResolvedValue([])
    pintar()
    expect(await screen.findByText('No hay hojas de ruta en curso.')).toBeTruthy()
  })

  it('si el servidor falla muestra el error y deja reintentar', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    pintar()
    expect(await screen.findByText('No se pudieron cargar las hojas de ruta.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('tocar una hoja abre la consola con ese id', async () => {
    mockGet.mockResolvedValue([HOJA('aaaaaaaa-1111', 'Juan Pérez', 'AB123CD', 4)])
    pintar()
    await userEvent.press(await screen.findByRole('button', { name: /Hoja #AAAAAAAA/ }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/logistica/consola', params: { id: 'aaaaaaaa-1111' } })
  })
})

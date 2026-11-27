import React from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { themeColors, useThemeStore } from '@/libs/theme'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
import { crearQueryClient } from '@/core/query/queryClient'
import { fechaCorta } from '@/core/utils/fecha'
import { FORM_MAX_WIDTH } from '@/core/ui/fw'
import { HojasDeRutaScreen } from '../components/HojasDeRutaScreen'

let mockAncho = 390
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: mockAncho, isTablet: mockAncho >= 600, isTabletLandscape: mockAncho >= 900 }) }))

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

const HOJA = (id: string, chofer: string, patente: string, paradas: number, estado = 2, codigo = 'HR-0142') =>
  ({ id, codigo, choferNombre: chofer, vehiculoPatente: patente, estado, fechaSalida: '2026-10-30T11:00:00Z', cantidadParadas: paradas, distanciaTotalMetros: 0, rutaCalculada: false })

const pintar = () => render(<QueryClientProvider client={crearQueryClient({ retry: false })}><HojasDeRutaScreen /></QueryClientProvider>)

beforeEach(() => { jest.clearAllMocks(); mockAncho = 390 })

describe('Hojas de ruta de la empresa: filas y bloque', () => {
  it('MD-9: the subtitle says "Todas las hojas"', async () => {
    mockGet.mockResolvedValue([])
    pintar()
    await screen.findByText('No hay hojas de ruta en curso.')
    expect(screen.getByText('Todas las hojas')).toBeTruthy()
    expect(screen.queryByText('De toda la empresa')).toBeNull()
  })

  it('MD-22: the quantity block has a fixed width, so every row lines up', async () => {
    mockGet.mockResolvedValue([HOJA('aaaaaaaa-1111', 'Juan Pérez', 'AB123CD', 4), HOJA('bbbbbbbb-2222', 'Ana Gómez', 'XY987ZT', 12)])
    pintar()
    await screen.findByText('Juan Pérez')
    const anchos = screen.getAllByTestId('bloque-entregas').map((b) => StyleSheet.flatten(b.props.style))
    expect(anchos).toHaveLength(2)
    for (const e of anchos) { expect(e.width).toBeGreaterThanOrEqual(72); expect(e.minWidth).toBeUndefined() }
  })
})

describe('Hojas de ruta de la empresa', () => {
  it('lista chofer, vehículo, entregas y estado de cada hoja', async () => {
    mockGet.mockResolvedValue([HOJA('aaaaaaaa-1111', 'Juan Pérez', 'AB123CD', 4), HOJA('bbbbbbbb-2222', 'Ana Gómez', 'XY987ZT', 1, 2, 'HR-0143')])
    pintar()
    expect(await screen.findByText('Juan Pérez')).toBeTruthy()
    expect(screen.getByText('Vehículo AB123CD')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('entregas')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('entrega')).toBeTruthy()
    expect(screen.getByText(`HR-0142 · ${fechaCorta('2026-10-30T11:00:00Z')}`)).toBeTruthy()
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
    await userEvent.press(await screen.findByRole('button', { name: /Hoja HR-0142/ }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/logistica/consola', params: { id: 'aaaaaaaa-1111' } })
  })
})

const estiloDe = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>

describe.each(['light', 'dark'] as const)('Hojas de ruta: receta FWD (%s)', (modo) => {
  beforeEach(() => useThemeStore.setState({ mode: modo }))

  it('cada fila es su tarjeta, sin bordes, con el bloque de entregas lime', async () => {
    mockGet.mockResolvedValue([HOJA('aaaaaaaa-1111', 'Juan Pérez', 'AB123CD', 4)])
    pintar()
    const fila = estiloDe(await screen.findByRole('button', { name: /Hoja HR-0142/ }))
    expect(fila).toMatchObject({ borderRadius: 22, backgroundColor: themeColors[modo].surface })
    expect(fila.borderBottomWidth ?? 0).toBe(0)
    expect(estiloDe(screen.getByTestId('bloque-entregas')).backgroundColor).toBe(themeColors[modo].lime)
  })

  it('una hoja finalizada va en teal, con bloque tinta y texto lime, y el estado escrito', async () => {
    mockGet.mockResolvedValue([HOJA('cccccccc-3333', 'Ramiro Benítez', 'AB123CD', 8, 3, 'HR-0150')])
    pintar()
    const fila = estiloDe(await screen.findByRole('button', { name: /Hoja HR-0150/ }))
    expect(fila.backgroundColor).toBe(themeColors[modo].teal)
    expect(estiloDe(screen.getByTestId('bloque-entregas')).backgroundColor).toBe(themeColors[modo].ink)
    expect(estiloDe(screen.getByText('8') as never).color).toBe(themeColors[modo].lime)
    expect(screen.getByLabelText('Estado: Finalizada')).toBeTruthy()
  })
})

describe('Hojas de ruta: ancho en tablet (P17 A, MD-16)', () => {
  const estilos = () => ({
    filtros: StyleSheet.flatten(screen.getByTestId('hojas-filtros').props.style),
    lista: StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle),
  })

  it('en tablet los filtros y la lista son una sola columna centrada de FORM_MAX_WIDTH (640)', async () => {
    mockAncho = 1194
    mockGet.mockResolvedValue([HOJA('aaaaaaaa-1111', 'Juan Pérez', 'AB123CD', 4)])
    pintar()
    await screen.findByText('Juan Pérez')
    const { filtros, lista } = estilos()
    for (const e of [filtros, lista]) { expect(e.maxWidth).toBe(FORM_MAX_WIDTH); expect(e.alignSelf).toBe('center') }
  })

  it('en teléfono no cambia: sin ancho máximo', async () => {
    mockGet.mockResolvedValue([HOJA('aaaaaaaa-1111', 'Juan Pérez', 'AB123CD', 4)])
    pintar()
    await screen.findByText('Juan Pérez')
    const { filtros, lista } = estilos()
    expect(filtros.maxWidth).toBeUndefined()
    expect(lista.maxWidth).toBeUndefined()
  })
})

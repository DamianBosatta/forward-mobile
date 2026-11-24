import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import type { ParadaDto } from '@/libs/api-client/types'
import { HojaDeRutaVista } from '../HojaDeRutaVista'

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
const mockAncho = jest.fn(() => 390)
jest.mock('@/libs/useResponsive', () => ({
  useResponsive: () => {
    const w = mockAncho()
    return { width: w, height: 800, isLarge: w >= 600, isTablet: w >= 600, isTabletLandscape: w >= 900, scale: (n: number) => n }
  },
}))

const p = (id: string, orden: number, direccion: string) =>
  ({ id, orden, ventaId: 'v' + id, clienteNombre: 'Cli ' + id, direccion, telefono: '1', cantidadBultos: 1, montoTotal: 10, latitud: 0, longitud: 0, estado: 1 }) as unknown as ParadaDto
const resumen = {
  total: 2, proxima: { parada: p('a', 1, 'Calle A 1'), numero: 1 },
  despues: [{ parada: p('b', 2, 'Calle B 2'), numero: 2 }], reportadas: [],
} as never
const base = { resumen, soloLectura: false, puedeReportar: true, onLlegue: jest.fn(), onComoLlegar: jest.fn(), onLlamar: jest.fn(), puedeLlamar: () => true, onNota: jest.fn(), notaCargando: false }

describe.each(['light', 'dark'] as const)('HojaDeRutaVista tablet (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('MD-17: on a wide tablet the next stop and the "Después" list sit side by side', () => {
    mockAncho.mockReturnValue(1100)
    render(<HojaDeRutaVista {...base} />)
    expect(screen.getByTestId('consola-dos-columnas')).toBeTruthy()
    expect(screen.getByTestId('consola-columna-proxima')).toBeTruthy()
    expect(screen.getByTestId('consola-columna-despues')).toBeTruthy()
  })

  it('on a phone it stays a single column', () => {
    mockAncho.mockReturnValue(390)
    render(<HojaDeRutaVista {...base} />)
    expect(screen.queryByTestId('consola-dos-columnas')).toBeNull()
    expect(screen.getByText('Después (1)')).toBeTruthy()
  })
})

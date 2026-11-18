import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import { MOTIVOS_NO_ENTREGA } from '../consola/hojaDeRuta'
import { ReportarParada } from '../consola/ReportarParada'

/** COD-R3-01: ReportarParada usa el aviso "Salir sin guardar" del resto de los formularios. */

let mockPrevenir: boolean | null = null
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (prevenir: boolean) => { mockPrevenir = prevenir; return jest.fn() },
}))
jest.mock('@/core/api/client', () => ({
  API_URL: 'http://api.test',
  api: { get: jest.fn().mockResolvedValue({ data: [] }), post: jest.fn() },
}))
// El hook real (el setup global lo reemplaza por un doble que no frena nada).
jest.unmock('@/core/hooks/useCambiosSinGuardar')


const parada = { id: 'p1', ventaId: 'v', clienteNombre: 'Marta', direccion: 'Calle 1', telefono: '', cantidadBultos: 1, latitud: 0, longitud: 0, estado: 1, montoTotal: 1000 }

const montar = (enviando = false) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  conTema('light')
  return render(
      <QueryClientProvider client={qc}>
        <ReportarParada
          hojaDeRutaId="h1" parada={parada as never} numero={1} enviando={enviando} error={null}
          exigeFotoRemito={false} resultadoInicial="noEntregado" onCerrar={jest.fn()} onConfirmar={jest.fn()}
        />
      </QueryClientProvider>,
  )
}

describe('ReportarParada: salir sin guardar', () => {
  beforeEach(() => { mockPrevenir = null })

  it('sin cargar nada no frena la salida', () => {
    montar()
    expect(mockPrevenir).toBe(false)
  })

  it('con un motivo elegido frena la salida', () => {
    montar()
    fireEvent.press(screen.getByText(MOTIVOS_NO_ENTREGA[0]))
    expect(mockPrevenir).toBe(true)
  })
})

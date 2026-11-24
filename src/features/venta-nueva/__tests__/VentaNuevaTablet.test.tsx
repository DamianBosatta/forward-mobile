import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CantidadOfertaPantalla } from '../components/CantidadOfertaPantalla'
import { producto } from '../__testing__/producto'
import { FORM_MAX_WIDTH } from '@/core/ui/fw/FormContainer'

jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 820, isTablet: true, isTabletLandscape: false }) }))
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn(), put: jest.fn(), post: jest.fn() } }))

describe('MV-23: en tablet el cuerpo y la barra de acción comparten la columna de 640', () => {
  it('la pantalla de cantidad usa FormContainer para el cuerpo y para la barra', () => {
    const qc = new QueryClient()
    render(<QueryClientProvider client={qc}><CantidadOfertaPantalla visible producto={producto({ bultoContenido: 10, disponible: 18 })} onClose={jest.fn()} onListo={jest.fn()} /></QueryClientProvider>)
    const columnas = screen.getAllByTestId('form-container')
    expect(columnas.length).toBeGreaterThanOrEqual(2)
    for (const c of columnas) expect(JSON.stringify(c.props.style)).toContain(String(FORM_MAX_WIDTH))
  })
})

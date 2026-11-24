import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { NuevaVentaInicio } from '../components/NuevaVentaInicio'
import { RevisarVenta } from '../components/RevisarVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CantidadOfertaPantalla } from '../components/CantidadOfertaPantalla'
import { producto } from '../__testing__/producto'
import { FORM_MAX_WIDTH } from '@/core/ui/fw/FormContainer'

jest.mock('../hooks/useUltimoPedido', () => ({ useUltimoPedido: () => ({ ultimo: null, cargando: false, error: false }) }))
jest.mock('../components/ElegirClienteVenta', () => ({ ElegirClienteVenta: () => null }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 820, isTablet: true, isTabletLandscape: false }) }))
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn(), put: jest.fn(), post: jest.fn() } }))

const columnasDe = (c: { props: Record<string, unknown> }) => StyleSheet.flatten(c.props.style as never)

describe('MV-23: en tablet el cuerpo y la barra de acción comparten la columna de 640', () => {
  it('la pantalla de cantidad usa FormContainer para el cuerpo y para la barra', () => {
    const qc = new QueryClient()
    render(<QueryClientProvider client={qc}><CantidadOfertaPantalla visible producto={producto({ bultoContenido: 10, disponible: 18 })} onClose={jest.fn()} onListo={jest.fn()} /></QueryClientProvider>)
    const columnas = screen.getAllByTestId('form-container')
    expect(columnas.length).toBeGreaterThanOrEqual(2)
    for (const c of columnas) expect(columnasDe(c)).toMatchObject({ maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' })
  })

  it('el paso 1 (elegir cliente) usa FormContainer para el cuerpo y para la barra de acción', () => {
    render(<NuevaVentaInicio tipo="Pedido" onTipo={jest.fn()} onElegir={jest.fn()} onNuevoCliente={jest.fn()} onVolver={jest.fn()} />)
    const columnas = screen.getAllByTestId('form-container')
    expect(columnas).toHaveLength(2)
    for (const c of columnas) expect(columnasDe(c)).toMatchObject({ maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' })
  })

  it('revisar la venta (carrito y entrega) usa FormContainer para el cuerpo y para la barra de acción', () => {
    const p = producto({ id: 'p1', nombre: 'Rollo', precioVenta: 1000, disponible: 10 })
    useCarritoVenta.setState({ lineas: [{ productoId: 'p1', producto: p, cantidad: 2, descuentoPct: 0 }] })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RevisarVenta paso="carrito" cliente={{ direccion: 'Tarantino 1898', nombreFantasia: 'Autoservicio Abel' }} descuentoGeneral={0} enviando={false} error={null} onConfirmar={jest.fn()} onEditarLinea={jest.fn()} />
      </QueryClientProvider>,
    )
    const columnas = screen.getAllByTestId('form-container')
    expect(columnas).toHaveLength(2)
    for (const c of columnas) expect(columnasDe(c)).toMatchObject({ maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' })
  })
})

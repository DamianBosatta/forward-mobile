import React from 'react'
import { render, screen, within } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocumentCard } from '@/core/ui/fw'
import { useThemeStore } from '@/libs/theme'
import { fechaHoraTexto } from '../../lib/fecha'
import { CompraDetalle } from '../../../../../app/(tabs)/compras/[id]'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, API_URL: 'x' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/core/auth/RequirePermission', () => ({ usePermissions: () => ({ canDo: () => true }) }))
const mockInsets = jest.fn()
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets() }))
const mockDims = jest.fn()
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims() }))

const plano = (o: Record<string, unknown> = {}) => (
  <DocumentCard plano numero="C-00232" vendedor="Ana" direccion="Insumos del Sur SA" nombre="C-00232 · Ana" hora="22:30" detalle="8 productos"
    importe={1234567.5} chip={null} onPress={() => {}} fechaHora="07/10/2026 22:30" {...o} />
)

describe('fechaHoraTexto', () => {
  it('muestra el día y la hora de Argentina, no los del teléfono', () => {
    expect(fechaHoraTexto('2026-10-08T01:30:00Z')).toBe('07/10/2026 22:30')
  })
  it('sin fecha o con una inválida no inventa nada', () => {
    expect(fechaHoraTexto(null)).toBeNull()
    expect(fechaHoraTexto('xx')).toBeNull()
  })
})

describe.each(['light', 'dark'] as const)('tarjeta de compra (%s)', (modo) => {
  beforeEach(() => { useThemeStore.setState({ mode: modo }) })

  it.each([360, 768])('a %i dp: el importe va formateado, en su propia celda a la derecha, y se ven fecha y hora del pedido', () => {
    render(plano())
    const importe = screen.getByTestId('documento-importe')
    expect(importe.props.numberOfLines).toBe(1)
    expect(importe).toHaveStyle({ textAlign: 'right', flexShrink: 0 })
    expect(within(screen.getByTestId('documento-importe')).getByText(/1\.234\.567,50/)).toBeTruthy()
    expect(screen.getByText('Pedido 07/10/2026 22:30')).toBeTruthy()
  })

  it('con el último cambio lo muestra; sin ese dato no inventa la línea', () => {
    const { rerender } = render(plano({ ultimoCambio: '08/10/2026 09:15' }))
    expect(screen.getByText('Último cambio 08/10/2026 09:15')).toBeTruthy()
    rerender(plano({ ultimoCambio: null }))
    expect(screen.queryByText(/Último cambio/)).toBeNull()
  })

  it('la etiqueta accesible incluye las fechas y el importe', () => {
    render(plano())
    expect(screen.getByRole('button').props.accessibilityLabel).toMatch(/Pedido 07\/10\/2026 22:30.*1\.234\.567,50/)
  })
})

describe('detalle de compra: márgenes del sistema', () => {
  const detalle = () => {
    mockDims.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 })
    mockGet.mockResolvedValue({
      id: 'a1', version: 1, proveedorId: 'p', razonSocialProveedor: 'Insumos del Sur SA', depositoId: 'd', nombreDeposito: 'Depósito Central',
      fecha: '2026-10-08T01:30:00Z', estado: 'NotaPedido', subtotalBrutoAmount: 10, descuentoTotalAmount: 0, gastosOperativos: 0, totalAmount: 10,
      conFactura: false, eliminada: false,
      detalles: [{ id: 'l1', productoId: 'pr1', nombreProducto: 'Balde', cantidad: 1, cantidadIngresada: 1, unidadCompra: 'Bulto', costoUnitarioBaseAmount: 10, costoUnitarioNetoAmount: 10, descuentoPorcentaje: 0, subtotalAmount: 10 }],
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><CompraDetalle id="a1" /></QueryClientProvider>)
  }

  it('la barra superior respeta la cámara y el pie de acciones la barra de navegación', async () => {
    mockInsets.mockReturnValue({ top: 40, bottom: 34, left: 0, right: 0 })
    detalle()
    const boton = await screen.findByRole('button', { name: 'Confirmar compra' })
    // El pie fijo suma el margen inferior del sistema al relleno de abajo (space[4] = 16).
    let nodo = boton.parent
    let relleno: number | undefined
    while (nodo && relleno === undefined) {
      const s = Array.isArray(nodo.props.style) ? Object.assign({}, ...nodo.props.style.flat(3).filter(Boolean)) : nodo.props.style
      if (s && typeof s.paddingBottom === 'number') relleno = s.paddingBottom
      nodo = nodo.parent
    }
    expect(relleno).toBe(16 + 34)
    const titulo = screen.getByRole('header', { name: 'Compra #A1' })
    let barra = titulo.parent
    let arriba: number | undefined
    while (barra && arriba === undefined) {
      const s = Array.isArray(barra.props.style) ? Object.assign({}, ...barra.props.style.flat(3).filter(Boolean)) : barra.props.style
      if (s && typeof s.paddingTop === 'number') arriba = s.paddingTop
      barra = barra.parent
    }
    expect(arriba).toBe(40)
  })
})

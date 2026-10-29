import React from 'react'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CatalogoConsultaScreen from '../../../../app/(tabs)/inventario/index'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { fichaDeCatalogo, paginaDeCatalogo } from '../testing/fichasDeCatalogo'

// R19: filtros "Con oferta" y "Línea / Familia" del catálogo. Pantalla real, react-query real,
// solo el transporte HTTP mockeado.

jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isLarge: false }) }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({ DrawerActions: { openDrawer: jest.fn() }, useFocusEffect: jest.fn() }))
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { get: jest.fn(), post: jest.fn() } }))
const mockSharePdf = jest.fn()
jest.mock('@/features/pedidos/lib/sharePdf', () => ({ sharePdf: (...a: unknown[]) => mockSharePdf(...a) }))

const { api } = jest.requireMock('@/core/api/client') as { api: { get: jest.Mock; post: jest.Mock } }

const AER = { id: 'p-aer', nombre: 'Saphirus Aerosol 250 ml', codigoPropio: 'SAP-AER-250', precioVenta: 3077.85, esPadreDeVariantes: false, activo: true }
const CATEGORIAS = [
  { id: 'l-hogar', nombre: 'Hogar', nivel: 1, categoriaPadreId: null, activo: true },
  { id: 'f-aero', nombre: 'Aerosoles', nivel: 2, categoriaPadreId: 'l-hogar', activo: true },
  { id: 'l-auto', nombre: 'Auto', nivel: 1, categoriaPadreId: null, activo: true },
]

function servidor(url: string) {
  if (url.startsWith('/api/v1/catalogo?')) return Promise.resolve(paginaDeCatalogo([fichaDeCatalogo(AER)]))
  if (url === '/api/v1/Categorias') return Promise.resolve(CATEGORIAS)
  return Promise.reject(new Error(`sin respuesta para ${url}`))
}

function renderPantalla() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={client}>
      <CatalogoConsultaScreen />
    </QueryClientProvider>,
  )
}

const productosPedidos = () =>
  api.get.mock.calls
    .map(([u]) => u as string)
    .filter((u) => u.startsWith('/api/v1/catalogo?'))
    .map((u) => new URLSearchParams(u.split('?')[1]))
const ultimoPedido = () => productosPedidos().at(-1)!

beforeEach(() => {
  api.get.mockReset().mockImplementation(servidor)
  api.post.mockReset().mockResolvedValue([{ productoId: AER.id, disponible: true }])
  mockSharePdf.mockReset().mockResolvedValue({ ok: true })
  useAuthStore.setState({
    user: { id: 'u1', username: 'u', roles: ['Vendedor'] as never, permissions: [{ module: 'MOD_CATALOGO', canRead: true }] as never },
  })
})

describe('Catálogo: filtros de oferta y Línea / Familia', () => {
  it('sin elegir nada no manda conOferta ni categoriaId', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    expect(ultimoPedido().has('ConOferta')).toBe(false)
    expect(ultimoPedido().has('CategoriaId')).toBe(false)
  })

  it('"Con oferta" manda conOferta=true y vuelve a la página 1; al apagarlo deja de mandarlo', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    const antes = productosPedidos().length

    await userEvent.press(screen.getByLabelText('Con oferta'))
    await waitFor(() => expect(productosPedidos().length).toBeGreaterThan(antes))
    expect(ultimoPedido().get('ConOferta')).toBe('true')
    expect(ultimoPedido().get('PageNumber')).toBe('1')

    // Apagado vuelve a la consulta sin filtro (ya guardada): el chip se apaga y no sale ningún pedido nuevo con conOferta.
    await userEvent.press(screen.getByLabelText('Con oferta'))
    await waitFor(() => expect(screen.getByLabelText('Con oferta').props.accessibilityState).toMatchObject({ selected: false }))
    expect(productosPedidos().filter((p) => p.has('ConOferta'))).toHaveLength(1)
  })

  it('el selector lista las Líneas con sus Familias y manda categoriaId al elegir una', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)

    await userEvent.press(screen.getByLabelText('Línea / Familia'))
    expect(await screen.findByLabelText('Hogar')).toBeTruthy()
    expect(screen.getByLabelText('Aerosoles')).toBeTruthy()
    expect(screen.getByLabelText('Auto')).toBeTruthy()

    await userEvent.press(screen.getByLabelText('Aerosoles'))
    await waitFor(() => expect(ultimoPedido().get('CategoriaId')).toBe('f-aero'))
    expect(ultimoPedido().get('PageNumber')).toBe('1')
    // El chip muestra lo elegido.
    expect(screen.getByLabelText('Línea / Familia: Aerosoles')).toBeTruthy()
  })

  it('"Todas" quita categoriaId', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    await userEvent.press(screen.getByLabelText('Línea / Familia'))
    await userEvent.press(await screen.findByLabelText('Auto'))
    await waitFor(() => expect(ultimoPedido().get('CategoriaId')).toBe('l-auto'))

    await userEvent.press(screen.getByLabelText('Línea / Familia: Auto'))
    await userEvent.press(await screen.findByLabelText('Todas'))
    await waitFor(() => expect(screen.getByLabelText('Línea / Familia').props.accessibilityState).toMatchObject({ selected: false }))
    expect(productosPedidos().filter((p) => p.has('CategoriaId'))).toHaveLength(1)
  })

  it('combina oferta, categoría y búsqueda en el mismo pedido', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)

    await userEvent.press(screen.getByLabelText('Con oferta'))
    await userEvent.press(screen.getByLabelText('Línea / Familia'))
    await userEvent.press(await screen.findByLabelText('Hogar'))
    await userEvent.type(screen.getByLabelText('Buscar por código o nombre'), 'sap')

    await waitFor(() => expect(ultimoPedido().get('SearchTerm')).toBe('sap'))
    expect(ultimoPedido().get('ConOferta')).toBe('true')
    expect(ultimoPedido().get('CategoriaId')).toBe('l-hogar')
  })

  it('no rompe "Con stock" ni la búsqueda: siguen funcionando con los filtros nuevos', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    await userEvent.press(screen.getByLabelText('Con stock'))
    expect(screen.getByLabelText('Con stock').props.accessibilityState).toMatchObject({ selected: true })
    await userEvent.type(screen.getByLabelText('Buscar por código o nombre'), 'sap')
    await waitFor(() => expect(ultimoPedido().get('SearchTerm')).toBe('sap'))
  })

  it('el PDF lleva la categoría, la oferta y "Con stock"', async () => {
    renderPantalla()
    await screen.findByText(AER.nombre)
    await userEvent.press(screen.getByLabelText('Con stock'))
    await userEvent.press(screen.getByLabelText('Con oferta'))
    await userEvent.press(screen.getByLabelText('Línea / Familia'))
    await userEvent.press(await screen.findByLabelText('Hogar'))
    await userEvent.press(screen.getByText('Compartir catálogo en PDF'))
    await userEvent.press(await screen.findByText('Generar PDF en tarjeta'))

    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1))
    const url = new URL(mockSharePdf.mock.calls[0][0] as string)
    expect(url.searchParams.get('CategoriaId')).toBe('l-hogar')
    expect(url.searchParams.get('ConOferta')).toBe('true')
    expect(url.searchParams.get('SoloDisponibles')).toBe('true')
  })
})

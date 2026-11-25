import React from 'react'
import { StyleSheet } from 'react-native'
import { screen } from '@testing-library/react-native'
import { FORM_MAX_WIDTH } from '@/core/ui/fw'
import { FichaProveedor } from '../components/FichaProveedor'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../../clientes/__testing__/ayuda'

// P17 A / MC-35: en tablet la ficha del proveedor va en una columna de FORM_MAX_WIDTH; el teléfono no cambia.

let mockAncho = 390
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: mockAncho, isTablet: mockAncho >= 600, isTabletLandscape: mockAncho >= 900 }) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
const contenido = () => StyleSheet.flatten(screen.getByTestId('ficha-scroll').props.contentContainerStyle)

beforeEach(() => {
  mockAncho = 390
  conPermisos([{ module: 'MOD_PROVEEDORES', canRead: true, canUpdate: true }, { module: 'MOD_CC', canRead: true }])
  get.mockImplementation(async (url: string) => (url.startsWith('/api/v1/Compras')
    ? pagina([], 0)
    : { ...clienteDeLista({ id: 'p1', razonSocial: 'Insumos del Sur SA', tipo: 'Proveedor' }), condicionesDeCompraFaltantes: [], condicionPago: { tipo: 'DiasDesdeFactura', dias: 30 } }))
})

describe('Ficha de proveedor: ancho', () => {
  it('en tablet va en una columna centrada de FORM_MAX_WIDTH (640)', async () => {
    mockAncho = 1194
    renderConQuery(<FichaProveedor id="p1" />)
    await screen.findByRole('header', { name: 'Insumos del Sur SA' })
    expect(contenido().maxWidth).toBe(FORM_MAX_WIDTH)
    expect(contenido().alignSelf).toBe('center')
  })

  it('en teléfono no cambia: sin ancho máximo', async () => {
    renderConQuery(<FichaProveedor id="p1" />)
    await screen.findByRole('header', { name: 'Insumos del Sur SA' })
    expect(contenido().maxWidth).toBeUndefined()
  })
})

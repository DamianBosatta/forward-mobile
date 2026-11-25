import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { FORM_MAX_WIDTH } from '@/core/ui/fw'
import { TotalesDeStock } from '../components/TotalesDeStock'

// P17 A / MD-20: en tablet los totales de Stock van en la columna de FORM_MAX_WIDTH; el teléfono no cambia.

let mockAncho = 390
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: mockAncho, isTablet: mockAncho >= 600, isTabletLandscape: mockAncho >= 900 }) }))

const RESUMEN = { totales: { filas: 2, articulos: 16, sinStock: 1, enAlerta: 4, conStock: 15, sinPeso: 0 }, depositos: [], lineas: [], marcas: [] }
const pintar = () => render(<TotalesDeStock resumen={RESUMEN as never} conError={false} vista="tarjetas" valorCosto={null} />)
const estilo = () => StyleSheet.flatten(screen.getByTestId('totales-de-stock').props.style)

beforeEach(() => { mockAncho = 390 })

describe('Totales de Stock: ancho', () => {
  it('en tablet van en una columna centrada de FORM_MAX_WIDTH (640)', () => {
    mockAncho = 1194
    pintar()
    expect(estilo().maxWidth).toBe(FORM_MAX_WIDTH)
    expect(estilo().alignSelf).toBe('center')
    expect(screen.getByLabelText('Artículos: 16')).toBeTruthy()
  })

  it('en teléfono no cambia: sin ancho máximo', () => {
    pintar()
    expect(estilo().maxWidth).toBeUndefined()
  })
})

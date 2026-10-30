import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { OfflineBanner } from '../OfflineBanner'

let mockConectado = false
let mockRuta = '/'
jest.mock('@/core/utils/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockConectado }) }))
jest.mock('expo-router', () => ({ usePathname: () => mockRuta }))

const TEXTO = /Sin conexión - Modo lectura/

describe('OfflineBanner', () => {
  beforeEach(() => { mockConectado = false; mockRuta = '/' })

  it('en una pantalla de solo lectura sin señal sigue mostrando el aviso', () => {
    mockRuta = '/inventario/stock'
    render(<OfflineBanner />)
    expect(screen.getByText(TEXTO)).toBeTruthy()
  })

  it('va en el flujo, no flotando: no tapa el encabezado de la pantalla', () => {
    mockRuta = '/inventario/stock'
    render(<OfflineBanner />)
    const estilo = StyleSheet.flatten(screen.getByTestId('aviso-sin-conexion').props.style)
    expect(estilo.position).not.toBe('absolute')
  })

  it('no se muestra en la consola del chofer: ahí el trabajo se encola y ella avisa', () => {
    mockRuta = '/logistica/consola'
    render(<OfflineBanner />)
    expect(screen.queryByText(TEXTO)).toBeNull()
  })

  it('no se muestra en la venta nueva, que también vende sin señal', () => {
    mockRuta = '/ventas/nueva'
    render(<OfflineBanner />)
    expect(screen.queryByText(TEXTO)).toBeNull()
  })

  it('con señal no se muestra en ninguna pantalla', () => {
    mockConectado = true
    render(<OfflineBanner />)
    expect(screen.queryByText(TEXTO)).toBeNull()
  })
})

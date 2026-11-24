/** MB-26: "Marcar leídos" deshabilitado se lee (el deshabilitado no baja el contraste: se pinta con el texto secundario). */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StyleSheet } from 'react-native'
import { render, screen, within } from '@testing-library/react-native'
import { themeColors } from '@/libs/theme'
import { PanelAvisos } from '../PanelAvisos'

const mockGet = jest.fn()
jest.mock('@/core/api/client', () => ({ api: { get: (url: string) => mockGet(url), post: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('Panel de avisos (tablet)', () => {
  it('sin avisos sin leer, "Marcar leídos" queda deshabilitado pero con el color y la opacidad de un texto legible', async () => {
    mockGet.mockResolvedValue({ items: [], noLeidas: 0, hayMas: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><PanelAvisos /></QueryClientProvider>)
    await screen.findByText('No tenés avisos.')
    const boton = screen.getByLabelText('Marcar leídos')
    expect(boton.props.accessibilityState.disabled).toBe(true)
    expect(StyleSheet.flatten(boton.props.style).opacity ?? 1).toBe(1)
    expect(StyleSheet.flatten(within(boton).getByText('Marcar leídos').props.style).color).toBe(themeColors.light.textSecondary)
  })
})

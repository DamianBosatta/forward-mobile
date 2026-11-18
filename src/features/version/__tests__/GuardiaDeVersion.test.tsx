import React from 'react'
import { Text } from 'react-native'
import { render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GuardiaDeVersion } from '../GuardiaDeVersion'

const mockComprobar = jest.fn()
jest.mock('../comprobarVersion', () => ({ comprobarVersion: (v: unknown) => mockComprobar(v) }))
jest.mock('@/features/perfil/lib/version', () => ({ leerDatosDeVersion: () => ({ version: '1.0.0' }) }))
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }))

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <GuardiaDeVersion><Text>la app</Text></GuardiaDeVersion>
    </SafeAreaProvider>,
  )

describe('GuardiaDeVersion', () => {
  beforeEach(() => mockComprobar.mockReset())

  it('no muestra la app hasta saber la respuesta, y la muestra si no bloquea', async () => {
    mockComprobar.mockResolvedValue({ bloquea: false, minima: null })
    montar()
    expect(screen.queryByText('la app')).toBeNull()
    await waitFor(() => expect(screen.getByText('la app')).toBeTruthy())
  })

  it('con una versión vieja muestra el aviso y no la app', async () => {
    mockComprobar.mockResolvedValue({ bloquea: true, minima: '1.4.0' })
    montar()
    await waitFor(() => expect(screen.getByText('Hay que actualizar la app')).toBeTruthy())
    expect(screen.queryByText('la app')).toBeNull()
  })
})

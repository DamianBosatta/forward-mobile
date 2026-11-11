/**
 * Mobile redesign, stage 4 (lámina perfil--clave): cambiar la contraseña es su propia ruta, a la que
 * se llega desde Mi cuenta. La llamada y las reglas son las de siempre (el servidor valida).
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { useAuthStore } from '@/libs/store/auth.store'
import ClaveRoute from '../../../../app/(tabs)/perfil/clave'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({ API_URL: 'http://api.test', api: { post: (u: string, b: unknown) => mockPost(u, b), get: jest.fn() } }))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack }) }))
jest.mock('expo-router/react-navigation', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), DrawerActions: { openDrawer: jest.fn() } }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isTabletLandscape: false, isLarge: false }) }))

function pintar() {
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1', username: 'ep', email: 'ep@forward.com.ar', roles: [], permissions: [] } } as never)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ClaveRoute /></QueryClientProvider>)
}
async function completar(actual: string, nueva: string, repetida: string) {
  await userEvent.type(screen.getByLabelText('Contraseña actual'), actual)
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), nueva)
  await userEvent.type(screen.getByLabelText('Repetir la contraseña nueva'), repetida)
}
const botonCambiar = () => screen.getByRole('button', { name: 'Cambiar contraseña' })

beforeEach(() => { jest.clearAllMocks(); mockPost.mockResolvedValue(true) })

describe('Cambiar contraseña (ruta propia)', () => {
  it('tiene su barra con título y vuelta a Mi cuenta', async () => {
    pintar()
    // Título de la barra + botón del formulario; el encabezado interno del formulario ya no está.
    expect(screen.getAllByText('Cambiar contraseña')).toHaveLength(2)
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('cambia la contraseña con el correo del usuario y limpia el formulario', async () => {
    pintar()
    expect(botonCambiar().props.accessibilityState.disabled).toBe(true)
    await completar('Vieja#2025', 'Nueva#20260', 'Nueva#20260')
    await userEvent.press(botonCambiar())
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Users/change-password', {
      email: 'ep@forward.com.ar', currentPassword: 'Vieja#2025', newPassword: 'Nueva#20260', confirmNewPassword: 'Nueva#20260',
    })
    expect(await screen.findByText(/la contraseña nueva ya vale/)).toBeTruthy()
    expect(screen.getByLabelText('Contraseña actual').props.value).toBe('')
  })

  it('si no coinciden no deja enviar', async () => {
    pintar()
    await completar('Vieja#2025', 'Nueva#20260', 'otra')
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy()
    expect(botonCambiar().props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('Se habilita cuando todo está completo y las dos nuevas coinciden.')).toBeTruthy()
  })

  it('los errores del servidor se muestran tal cual', async () => {
    pintar()
    await completar('Vieja#2025', 'Nueva#20260', 'Nueva#20260')
    mockPost.mockRejectedValueOnce(new Error('La contraseña actual no es correcta.'))
    await userEvent.press(botonCambiar())
    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeTruthy()
  })
})

describe('Reglas de la contraseña nueva en vivo (S6)', () => {
  const regla = (nombre: string) => screen.getByLabelText(new RegExp(`^${nombre}`))

  it('cada regla dice cumple o falta con texto, no solo con color, y se actualiza al escribir', async () => {
    pintar()
    const nueva = screen.getByLabelText('Contraseña nueva')
    expect(screen.getAllByText(/· falta$/)).toHaveLength(5)
    await userEvent.type(nueva, 'abcdefghij')
    expect(screen.getByText('Mínimo 10 caracteres · cumple')).toBeTruthy()
    expect(screen.getByText('Una minúscula · cumple')).toBeTruthy()
    expect(screen.getByText('Una mayúscula · falta')).toBeTruthy()
    expect(screen.getByText('Un número · falta')).toBeTruthy()
    expect(screen.getByText('Un símbolo · falta')).toBeTruthy()
    await userEvent.type(nueva, 'A1!')
    expect(screen.queryAllByText(/· falta$/)).toHaveLength(0)
    expect(screen.getAllByText(/· cumple$/)).toHaveLength(5)
    await userEvent.clear(nueva)
    await userEvent.type(nueva, 'corta')
    expect(screen.getByText('Mínimo 10 caracteres · falta')).toBeTruthy()
    expect(regla('Un símbolo').props.accessibilityLabel).toBe('Un símbolo · falta')
  })

  it('no deja enviar mientras la regla no pase, aunque las dos nuevas coincidan', async () => {
    pintar()
    await completar('Vieja#2025', 'corta', 'corta')
    expect(botonCambiar().props.accessibilityState.disabled).toBe(true)
    await userEvent.press(botonCambiar())
    expect(mockPost).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'Larga#2026')
    await userEvent.type(screen.getByLabelText('Repetir la contraseña nueva'), 'Larga#2026')
    expect(botonCambiar().props.accessibilityState.disabled).toBe(false)
  })
})

describe('Cambiar contraseña como venta (propuesta Cuenta, frames 4 y 5)', () => {
  it('los tres campos van en una tarjeta sin borde y las reglas en otra', () => {
    pintar()
    const campos = screen.getByTestId('tarjeta-campos')
    for (const l of ['Contraseña actual', 'Contraseña nueva', 'Repetir la contraseña nueva']) expect(within(campos).getByLabelText(l)).toBeTruthy()
    const reglas = screen.getByTestId('tarjeta-reglas')
    expect(within(reglas).getAllByText(/· falta$/)).toHaveLength(5)
    for (const t of ['tarjeta-campos', 'tarjeta-reglas']) expect(StyleSheet.flatten(screen.getByTestId(t).props.style).borderWidth ?? 0).toBe(0)
  })

  it('el botón va en el pie fijo, con la explicación de cuándo se habilita', async () => {
    pintar()
    const pie = screen.getByTestId('pie-clave')
    expect(within(pie).getByRole('button', { name: 'Cambiar contraseña' }).props.accessibilityState.disabled).toBe(true)
    expect(within(pie).getByText('Se habilita cuando todo está completo y las dos nuevas coinciden.')).toBeTruthy()
    await completar('Vieja#2025', 'Nueva#20260', 'Nueva#20260')
    expect(within(pie).getByRole('button', { name: 'Cambiar contraseña' }).props.accessibilityState.disabled).toBe(false)
    expect(within(pie).queryByText('Se habilita cuando todo está completo y las dos nuevas coinciden.')).toBeNull()
  })

  it('el aviso de listo queda arriba de las tarjetas, a la vista', async () => {
    pintar()
    await completar('Vieja#2025', 'Nueva#20260', 'Nueva#20260')
    await userEvent.press(botonCambiar())
    await screen.findByText(/la contraseña nueva ya vale/)
    const plano = JSON.stringify(screen.toJSON())
    expect(plano.indexOf('la contraseña nueva ya vale')).toBeLessThan(plano.indexOf('tarjeta-campos'))
  })
})

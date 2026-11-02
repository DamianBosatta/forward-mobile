/**
 * Audit tranche 1, S2: after the first password login the app asks whether to enter with the fingerprint next
 * time. "Solo si aceptás se guarda la credencial, protegida con autenticación del dispositivo."
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { OfertaDeHuella } from '../../components/OfertaDeHuella'
import { useOfertaDeHuella } from '../../store/ofertaDeHuella.store'
import { useAuthStore } from '../../store/auth.store'

const mockAccept = jest.fn()
const mockDecline = jest.fn()
jest.mock('../../utils/biometrics', () => ({
  acceptBiometricLogin: (c: unknown) => mockAccept(c),
  declineBiometricLogin: (u: unknown) => mockDecline(u),
}))

const CREDS = { username: 'admin', password: 'secreta123' }
const PREGUNTA = '¿Querés entrar con huella la próxima vez?'

beforeEach(() => {
  jest.clearAllMocks()
  mockAccept.mockResolvedValue(true)
  mockDecline.mockResolvedValue(undefined)
  useOfertaDeHuella.getState().descartar()
  useAuthStore.setState({ isAuthenticated: true, accessToken: 't1', refreshToken: 'r1' })
})

describe('oferta de entrar con huella', () => {
  it('without a pending offer it asks nothing', () => {
    render(<OfertaDeHuella />)
    expect(screen.queryByText(PREGUNTA)).toBeNull()
  })

  it('says the credential is erased when the user logs out from the app (a forced logout keeps it)', () => {
    useOfertaDeHuella.getState().ofrecer(CREDS)
    render(<OfertaDeHuella />)
    expect(screen.getByText(/Se borran cuando cerrás sesión desde la app\.$/)).toBeTruthy()
    expect(screen.queryByText(/Al cerrar sesión se borran/)).toBeNull()
  })

  it('accepting stores the credential and closes the question', async () => {
    useOfertaDeHuella.getState().ofrecer(CREDS)
    render(<OfertaDeHuella />)
    fireEvent.press(screen.getByText('Sí, usar huella'))
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith(CREDS))
    expect(mockDecline).not.toHaveBeenCalled()
    await waitFor(() => expect(useOfertaDeHuella.getState().pendiente).toBeNull())
  })

  it('declining stores nothing and closes the question', async () => {
    useOfertaDeHuella.getState().ofrecer(CREDS)
    render(<OfertaDeHuella />)
    expect(screen.getByText(PREGUNTA)).toBeTruthy()
    fireEvent.press(screen.getByText('Ahora no'))
    await waitFor(() => expect(mockDecline).toHaveBeenCalledWith('admin'))
    expect(mockAccept).not.toHaveBeenCalled()
    await waitFor(() => expect(useOfertaDeHuella.getState().pendiente).toBeNull())
  })

  it('with the session closed it asks nothing', () => {
    useOfertaDeHuella.getState().ofrecer(CREDS)
    useAuthStore.setState({ isAuthenticated: false, accessToken: null, refreshToken: null })
    render(<OfertaDeHuella />)
    expect(screen.queryByText(PREGUNTA)).toBeNull()
  })
})

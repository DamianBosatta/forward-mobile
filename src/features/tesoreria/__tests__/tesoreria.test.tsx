import React from 'react'
import fs from 'fs'
import path from 'path'
import { screen } from '@testing-library/react-native'
import TesoreriaScreen from '../../../../app/(tabs)/tesoreria/index'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn() },
  API_URL: '',
}))

const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

/** Bloque 12, T2 (D10; reglas mobile: "NO: depósito ni endoso de cheques"): los cheques se operan en la web. */
describe('Tesorería sin cheques', () => {
  it('no ofrece depositar cheques aunque el usuario gestione cheques en la web', async () => {
    conPermisos([
      { module: 'MOD_PAGOS', canRead: true, canCreate: true, canUpdate: true },
      { module: 'MOD_CC', canRead: true },
      { module: 'CAP_GESTIONAR_CHEQUES', canRead: true },
    ])
    renderConQuery(<TesoreriaScreen />)
    expect(await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Depositar cheques' })).toBeNull()
    expect(screen.queryByText(/cheques/i)).toBeNull()
  })

  it('sin permiso para transferir dice que no hay acciones, aunque gestione cheques', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canUpdate: true }, { module: 'MOD_CC', canRead: true }, { module: 'CAP_GESTIONAR_CHEQUES', canRead: true }])
    renderConQuery(<TesoreriaScreen />)
    expect(await screen.findByText('No tenés acciones de tesorería habilitadas.', {}, ESPERA)).toBeTruthy()
  })

  it('la pantalla de depósito de cheques ya no existe', () => {
    expect(fs.existsSync(path.join(__dirname, '../../../../app/(tabs)/tesoreria/cheques.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(__dirname, '../components/DepositoCheques.tsx'))).toBe(false)
  })
})

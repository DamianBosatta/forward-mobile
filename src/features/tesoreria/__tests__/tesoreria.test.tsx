import React from 'react'
import fs from 'fs'
import path from 'path'
import { screen } from '@testing-library/react-native'
import TesoreriaScreen from '../../../../app/(tabs)/tesoreria/index'
import { MOTIVO_SIN_PERMISO_DE_SERVICIO } from '@/core/ui/fw/MotivoDeshabilitado'
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

  it('muestra la fila de transferencia con su subtítulo y el aviso de que los cobros van con "Cobrar" (lámina tesoreria-inicio)', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }])
    renderConQuery(<TesoreriaScreen />)
    expect(await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA)).toBeTruthy()
    expect(screen.getByText('Mové plata entre tus cuentas')).toBeTruthy()
    expect(screen.getByText('Los cobros de clientes se cargan desde la ficha del cliente, con "Cobrar".')).toBeTruthy()
    // L22: "Servicio sí, cheque después": la fila de cheque no se ofrece hasta tener POST /cheques.
    expect(screen.queryByText('Cargar un cheque')).toBeNull()
  })

  it('ofrece "Pagar un servicio" con el permiso del servidor y la deja deshabilitada, con motivo, sin él', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'CAP_VER_TESORERIA', canRead: true }])
    const { unmount } = renderConQuery(<TesoreriaScreen />)
    const fila = await screen.findByRole('button', { name: 'Pagar un servicio' }, ESPERA)
    expect(fila.props.accessibilityState.disabled).toBe(false)
    unmount()

    conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
    renderConQuery(<TesoreriaScreen />)
    const sin = await screen.findByRole('button', { name: 'Pagar un servicio' }, ESPERA)
    expect(sin.props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_SERVICIO)).toBeTruthy()
  })

  it('sin permiso para transferir muestra el botón deshabilitado con el motivo de la web (L13), aunque gestione cheques', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canUpdate: true }, { module: 'MOD_CC', canRead: true }, { module: 'CAP_GESTIONAR_CHEQUES', canRead: true }])
    renderConQuery(<TesoreriaScreen />)
    const boton = await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA)
    expect(boton.props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('No tenés permiso para registrar movimientos entre cuentas. Pedile a un administrador que te asigne el permiso de alta en el módulo Pagos.')).toBeTruthy()
    expect(screen.queryByText('No tenés acciones de tesorería habilitadas.')).toBeNull()
  })

  it('la pantalla de depósito de cheques ya no existe', () => {
    expect(fs.existsSync(path.join(__dirname, '../../../../app/(tabs)/tesoreria/cheques.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(__dirname, '../components/DepositoCheques.tsx'))).toBe(false)
  })
})

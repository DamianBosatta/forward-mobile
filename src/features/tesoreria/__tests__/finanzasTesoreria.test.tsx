import React from 'react'
import { StyleSheet } from 'react-native'
import { screen, within } from '@testing-library/react-native'
import TesoreriaScreen from '../../../../app/(tabs)/tesoreria/index'
import { MOTIVO_SIN_PERMISO_DE_SERVICIO, MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA } from '@/core/ui/fw/MotivoDeshabilitado'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

/** Propuesta "Finanzas como venta", frames 8 y 9 (Tesorería). */

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn(), post: jest.fn() }, API_URL: '' }))

const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

describe('Tesorería con permisos (frame 8)', () => {
  it('las acciones van en una tarjeta sin borde, en filas de 64 px con su ícono en un cuadrado y la flecha', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }, { module: 'CAP_VER_TESORERIA', canRead: true }])
    renderConQuery(<TesoreriaScreen />)

    const tarjeta = await screen.findByTestId('tarjeta-tesoreria', {}, ESPERA)
    expect(StyleSheet.flatten(tarjeta.props.style).borderWidth ?? 0).toBe(0)
    for (const nombre of ['Transferencia entre cuentas', 'Pagar un servicio', 'Cargar un cheque']) {
      const fila = within(tarjeta).getByRole('button', { name: nombre })
      expect(StyleSheet.flatten(fila.props.style).minHeight).toBe(64)
      expect(within(fila).getByTestId('fila-icono')).toBeTruthy()
      expect(within(fila).getByTestId('fila-chevron')).toBeTruthy()
      expect(within(fila).queryByTestId('fila-candado')).toBeNull()
    }
  })
})

describe('Tesorería sin permisos (frame 9)', () => {
  it('la fila no se oculta: el ícono pasa a candado, sin flecha, y el motivo completo queda dentro de la misma fila', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
    renderConQuery(<TesoreriaScreen />)

    const transferir = await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA)
    expect(transferir.props.accessibilityState.disabled).toBe(true)
    expect(within(transferir).getByTestId('fila-candado')).toBeTruthy()
    expect(within(transferir).queryByTestId('fila-chevron')).toBeNull()
    expect(within(transferir).getByText(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA)).toBeTruthy()

    const servicio = screen.getByRole('button', { name: 'Pagar un servicio' })
    expect(within(servicio).getByTestId('fila-candado')).toBeTruthy()
    expect(within(servicio).getByText(MOTIVO_SIN_PERMISO_DE_SERVICIO)).toBeTruthy()
  })
})

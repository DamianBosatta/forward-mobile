// El formulario de una sola pantalla (panel de la tablet de Cuentas): los cuerpos que manda y la clave de
// idempotencia, fijados para que el cobro en pasos no los cambie (mismos escenarios en cobroPayloads.pasos).
import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { RegistrarCobro } from '../components/RegistrarCobro'
import { COBRO_CON_LO_DE_ANTES, COBRO_YA_ESTABA } from '../components/CobroListo'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import {
  DOS_CAJAS, ESCENARIOS, ESPERA, claves, deOtroSocio, ok, otroCuerpo, post, servidor, sinClave, sinRed, subir, urlDeFoto, type Escenario,
} from '../__testing__/escenariosCobro'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/core/api/client', () => ({ ...jest.requireActual('@/core/api/client'), api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() }, API_URL: '' }))
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///foto.jpg' }] }),
  launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///foto.jpg' }] }),
}))
jest.setTimeout(30_000)

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  servidor()
  post.mockResolvedValue(ok())
  subir.mockImplementation(async (url: string) => urlDeFoto(url))
})

const registrar = () => userEvent.press(screen.getByRole('button', { name: /^Registrar cobro/ }))

async function llenar(e: Pick<Escenario, 'lineas' | 'imputar' | 'referencia'>) {
  for (const [i, l] of e.lineas.entries()) {
    if (i === 0) {
      fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), l.monto)
      await userEvent.press((await screen.findAllByRole('radio', { name: l.medio }, ESPERA))[0])
    } else {
      await userEvent.press(screen.getByRole('button', { name: 'Otro medio' }))
      fireEvent.changeText(await screen.findByLabelText(`Monto del medio ${i + 1}`), l.monto)
      await userEvent.press(screen.getAllByRole('radio', { name: l.medio })[i])
    }
    if (l.caja) await userEvent.press(await screen.findByRole('radio', { name: l.caja }, ESPERA))
    if (l.cuenta) await userEvent.press(await screen.findByRole('radio', { name: l.cuenta }, ESPERA))
    if (l.cheque) {
      fireEvent.changeText(screen.getByLabelText('N.º de cheque'), l.cheque.numero)
      fireEvent.changeText(screen.getByLabelText('Banco'), l.cheque.banco)
      fireEvent.changeText(screen.getByLabelText('Titular'), l.cheque.titular)
    }
    if (l.foto) {
      const que = l.cheque ? 'del cheque' : 'del comprobante'
      await userEvent.press(await screen.findByRole('button', { name: `Sacar foto ${que}` }, ESPERA))
      await screen.findByText(`Foto ${que} cargada`, {}, ESPERA)
    }
  }
  if (e.imputar) {
    await userEvent.press(screen.getByRole('radio', { name: 'Elegir comprobantes' }))
    for (const [doc, monto] of e.imputar) {
      await userEvent.press(await screen.findByRole('checkbox', { name: doc }, ESPERA))
      if (monto) fireEvent.changeText(screen.getByLabelText(`Monto a imputar a ${doc.split(',')[0]}`), monto)
    }
  }
  if (e.referencia) fireEvent.changeText(screen.getByLabelText('Referencia (opcional)'), e.referencia)
}

const montar = () => renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} conBarra />)

describe('cuerpos del formulario de siempre', () => {
  it.each(ESCENARIOS.map(e => [e.nombre, e] as const))('%s', async (_nombre, e) => {
    servidor(e.cajas)
    montar()
    await llenar(e)
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][0]).toBe('/api/v1/Finanzas/pagos/multilinea')
    expect(post.mock.calls[0][1].claveIdempotencia).toMatch(/^mobile-/)
    expect(sinClave(post.mock.calls[0][1])).toEqual(e.esperado)
  })
})

describe('idempotencia del formulario de siempre', () => {
  it('la misma clave al reintentar y tras editar; otra tras "Registrar otro cobro"', async () => {
    post.mockRejectedValueOnce(sinRed()).mockRejectedValueOnce(sinRed()).mockResolvedValueOnce(ok())
    montar()
    await llenar(ESCENARIOS[0])
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2), ESPERA)
    fireEvent.changeText(screen.getByLabelText('Monto'), '31.000')
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3), ESPERA)
    await userEvent.press(await screen.findByRole('button', { name: 'Registrar otro cobro' }, ESPERA))
    await llenar(ESCENARIOS[0])
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(4), ESPERA)

    const k = claves()
    expect(k[1]).toBe(k[0])
    expect(k[2]).toBe(k[1])
    expect(k[3]).not.toBe(k[2])
    expect(post.mock.calls.map(c => c[1].lineas[0].monto)).toEqual([30000, 30000, 31000, 30000])
  })

  it('un 200 repetido avisa que el cobro ya estaba registrado', async () => {
    post.mockResolvedValueOnce(ok({ message: 'Pago registrado con esta clave de idempotencia (operación repetida)' }))
    montar()
    await llenar(ESCENARIOS[0])
    await registrar()
    expect(await screen.findByText(COBRO_YA_ESTABA, {}, ESPERA)).toBeTruthy()
  })

  it('un 409 con otro cuerpo avisa que quedó con los datos de antes', async () => {
    post.mockRejectedValueOnce(otroCuerpo())
    montar()
    await llenar(ESCENARIOS[0])
    await registrar()
    expect(await screen.findByText(COBRO_CON_LO_DE_ANTES, {}, ESPERA)).toBeTruthy()
  })

  it('un 409 de otro cliente muestra el error y el siguiente intento usa otra clave', async () => {
    post.mockRejectedValueOnce(deOtroSocio()).mockResolvedValueOnce(ok())
    montar()
    await llenar(ESCENARIOS[0])
    await registrar()
    expect(await screen.findByText(/ya se usó en otra operación/, {}, ESPERA)).toBeTruthy()
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2), ESPERA)
    const k = claves()
    expect(k[1]).not.toBe(k[0])
  })

  it('con dos cajas y ninguna elegida no manda y pide la caja', async () => {
    servidor(DOS_CAJAS)
    montar()
    await llenar({ lineas: [{ medio: 'Efectivo', monto: '1.000' }] })
    await registrar()
    expect(await screen.findByText('Elegí en qué caja entra el efectivo.', {}, ESPERA)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })
})

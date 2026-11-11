// El cobro en pasos de la pantalla Cobrar: con los mismos datos manda el mismo cuerpo que el formulario de
// siempre (cobroPayloads.formulario) y conserva las reglas de la clave de idempotencia.
import React from 'react'
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import CobroRoute from '@/app/(tabs)/cuentas/cobro'
import { COBRO_CON_LO_DE_ANTES, COBRO_YA_ESTABA } from '../components/CobroListo'
import { IMPUTADO_DE_MAS } from '../lib/cobro'
import { formatImporte } from '@/core/ui/fw/formatImporte'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import {
  DOS_CAJAS, ESCENARIOS, ESPERA, claves, deOtroSocio, ok, otroCuerpo, post, servidor, sinClave, sinRed, subir, urlDeFoto, type Escenario,
} from '../__testing__/escenariosCobro'

let mockParams: Record<string, string | undefined> = {}
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams }))
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
  mockParams = { socioId: 'c1' }
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  servidor()
  post.mockResolvedValue(ok())
  subir.mockImplementation(async (url: string) => urlDeFoto(url))
})

const presionar = async (n: string | RegExp) => userEvent.press(await screen.findByRole('button', { name: n }, ESPERA))
const registrar = () => presionar(/^Registrar cobro/)
const apagado = (nombre: string) => screen.getByRole('button', { name: nombre }).props.accessibilityState?.disabled === true

/** Del paso 2 al 4: imputación, un "Medio y monto" por línea y la referencia. */
async function llenar(e: Pick<Escenario, 'lineas' | 'imputar' | 'referencia'>) {
  await screen.findByText('Paso 2 de 4', {}, ESPERA)
  if (e.imputar) {
    await userEvent.press(await screen.findByRole('radio', { name: 'Elegir comprobantes' }, ESPERA))
    for (const [doc, monto] of e.imputar) {
      await userEvent.press(await screen.findByRole('checkbox', { name: doc }, ESPERA))
      if (monto) fireEvent.changeText(screen.getByLabelText(`Monto a imputar a ${doc.split(',')[0]}`), monto)
    }
  }
  await presionar('Continuar a medios')
  for (const [i, l] of e.lineas.entries()) {
    await presionar(i === 0 ? 'Agregar un medio' : 'Agregar otro medio')
    await userEvent.press(await screen.findByRole('radio', { name: l.medio }, ESPERA))
    fireEvent.changeText(screen.getByLabelText('Monto'), l.monto)
    if (l.caja) await userEvent.press(await screen.findByRole('radio', { name: l.caja }, ESPERA))
    if (l.cuenta) await userEvent.press(await screen.findByRole('radio', { name: l.cuenta }, ESPERA))
    if (l.cheque) {
      fireEvent.changeText(screen.getByLabelText('N.º de cheque'), l.cheque.numero)
      fireEvent.changeText(screen.getByLabelText('Banco'), l.cheque.banco)
      fireEvent.changeText(screen.getByLabelText('Titular'), l.cheque.titular)
    }
    if (l.foto) {
      const que = l.cheque ? 'del cheque' : 'del comprobante'
      await presionar(`Sacar foto ${que}`)
      await screen.findByText(`Foto ${que} cargada`, {}, ESPERA)
    }
    await presionar('Agregar este medio')
    await screen.findByText('Paso 3 de 4', {}, ESPERA)
  }
  await presionar('Continuar a confirmar')
  await screen.findByText('Paso 4 de 4', {}, ESPERA)
  if (e.referencia) fireEvent.changeText(screen.getByLabelText('Referencia (opcional)'), e.referencia)
}

/** Paso 3 con una sola línea, sin pasar por el resto. */
async function abrirMedio(medio: string, monto: string) {
  await screen.findByText('Paso 2 de 4', {}, ESPERA)
  await presionar('Continuar a medios')
  await presionar('Agregar un medio')
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
  fireEvent.changeText(screen.getByLabelText('Monto'), monto)
}

describe('cuerpos del cobro en pasos (los mismos que el formulario de siempre)', () => {
  it.each(ESCENARIOS.map(e => [e.nombre, e] as const))('%s', async (_nombre, e) => {
    servidor(e.cajas)
    renderConQuery(<CobroRoute />)
    await llenar(e)
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    expect(post.mock.calls[0][0]).toBe('/api/v1/Finanzas/pagos/multilinea')
    expect(post.mock.calls[0][1].claveIdempotencia).toMatch(/^mobile-/)
    expect(sinClave(post.mock.calls[0][1])).toEqual(e.esperado)
  })
})

describe('idempotencia del cobro en pasos', () => {
  it('la misma clave al reintentar y tras editar un medio; otra tras "Registrar otro cobro"', async () => {
    post.mockRejectedValueOnce(sinRed()).mockRejectedValueOnce(sinRed()).mockResolvedValueOnce(ok())
    renderConQuery(<CobroRoute />)
    await llenar(ESCENARIOS[0])
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2), ESPERA)
    // Vuelve al paso 3, cambia el monto y confirma de nuevo.
    await userEvent.press(screen.getByLabelText('Volver'))
    await presionar(/^Editar Efectivo/)
    fireEvent.changeText(screen.getByLabelText('Monto'), '31.000')
    await presionar('Guardar este medio')
    await presionar('Continuar a confirmar')
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3), ESPERA)
    await presionar('Registrar otro cobro')
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
    renderConQuery(<CobroRoute />)
    await llenar(ESCENARIOS[0])
    await registrar()
    expect(await screen.findByText(COBRO_YA_ESTABA, {}, ESPERA)).toBeTruthy()
  })

  it('un 409 con otro cuerpo avisa que quedó con los datos de antes', async () => {
    post.mockRejectedValueOnce(otroCuerpo())
    renderConQuery(<CobroRoute />)
    await llenar(ESCENARIOS[0])
    await registrar()
    expect(await screen.findByText(COBRO_CON_LO_DE_ANTES, {}, ESPERA)).toBeTruthy()
  })

  it('un 409 de otro cliente muestra el error y el siguiente intento usa otra clave', async () => {
    post.mockRejectedValueOnce(deOtroSocio()).mockResolvedValueOnce(ok())
    renderConQuery(<CobroRoute />)
    await llenar(ESCENARIOS[0])
    await registrar()
    expect(await screen.findByText(/ya se usó en otra operación/, {}, ESPERA)).toBeTruthy()
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2), ESPERA)
    const k = claves()
    expect(k[1]).not.toBe(k[0])
  })

  it('sin cliente: volver al paso 1 tras un corte y elegir el mismo cliente arranca otro cobro, con otra clave', async () => {
    mockParams = {}
    post.mockRejectedValueOnce(sinRed()).mockResolvedValueOnce(ok())
    renderConQuery(<CobroRoute />)
    await presionar(/^Av\. del Valle 89/)
    await presionar('Continuar a qué se cobra')
    await llenar(ESCENARIOS[0])
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), ESPERA)
    for (let i = 0; i < 3; i++) await userEvent.press(screen.getByLabelText('Volver'))
    await screen.findByText('Paso 1 de 4', {}, ESPERA)
    await presionar(/^Av\. del Valle 89/)
    await presionar('Continuar a qué se cobra')
    // Otro cobro: el formulario arranca vacío.
    await presionar('Continuar a medios')
    expect(await screen.findByRole('button', { name: 'Agregar un medio' }, ESPERA)).toBeTruthy()
    await userEvent.press(screen.getByLabelText('Volver'))
    await llenar(ESCENARIOS[0])
    await registrar()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2), ESPERA)

    const k = claves()
    expect(k[1]).not.toBe(k[0])
  })
})

describe('reglas del cobro en pasos', () => {
  it('con dos cajas y ninguna elegida no se agrega el efectivo', async () => {
    servidor(DOS_CAJAS)
    renderConQuery(<CobroRoute />)
    await abrirMedio('Efectivo', '1.000')
    expect(await screen.findByText('Elegí en qué caja entra el efectivo.', {}, ESPERA)).toBeTruthy()
    expect(apagado('Agregar este medio')).toBe(true)
    expect(post).not.toHaveBeenCalled()
  })

  it('sin ninguna caja abierta no se agrega el efectivo', async () => {
    servidor([])
    renderConQuery(<CobroRoute />)
    await abrirMedio('Efectivo', '1.000')
    expect(await screen.findByText(/No hay ninguna caja abierta/, {}, ESPERA)).toBeTruthy()
    expect(apagado('Agregar este medio')).toBe(true)
  })

  it('con un cheque como segundo medio no se puede confirmar', async () => {
    renderConQuery(<CobroRoute />)
    await abrirMedio('Transferencia', '1.000')
    await presionar('Agregar este medio')
    await presionar('Agregar otro medio')
    await userEvent.press(await screen.findByRole('radio', { name: 'Cheque' }, ESPERA))
    fireEvent.changeText(screen.getByLabelText('Monto'), '2.000')
    await presionar('Agregar este medio')
    await screen.findByText('Paso 3 de 4', {}, ESPERA)
    expect(apagado('Continuar a confirmar')).toBe(true)
  })

  it('lo imputado no puede superar el cobro: no se puede confirmar', async () => {
    renderConQuery(<CobroRoute />)
    await screen.findByText('Paso 2 de 4', {}, ESPERA)
    await userEvent.press(await screen.findByRole('radio', { name: 'Elegir comprobantes' }, ESPERA))
    await userEvent.press(await screen.findByRole('checkbox', { name: `A00409, pendiente ${formatImporte(50000)}` }, ESPERA))
    await presionar('Continuar a medios')
    await presionar('Agregar un medio')
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    fireEvent.changeText(screen.getByLabelText('Monto'), '20.000')
    await presionar('Agregar este medio')
    expect(await screen.findByText(IMPUTADO_DE_MAS, {}, ESPERA)).toBeTruthy()
    expect(apagado('Continuar a confirmar')).toBe(true)
  })

  it('volver de "Medio y monto" mientras sube la foto: al terminar no se vuelve a abrir', async () => {
    let terminar: (v: { url: string }) => void = () => {}
    subir.mockImplementation(() => new Promise(r => { terminar = r }))
    renderConQuery(<CobroRoute />)
    await abrirMedio('Transferencia', '1.000')
    await presionar('Sacar foto del comprobante')
    await waitFor(() => expect(subir).toHaveBeenCalledTimes(1), ESPERA)
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(await screen.findByText('Paso 3 de 4', {}, ESPERA)).toBeTruthy()

    // Termina la subida y corre lo que queda pendiente (la URL que vuelve y el fin de "subiendo").
    await act(async () => {
      terminar({ url: 'https://r2.forward/upload-comprobante/foto.jpg' })
      await new Promise(r => setTimeout(r, 50))
    })
    expect(screen.queryByText('Medio y monto')).toBeNull()
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar un medio' })).toBeTruthy()
  })
})

describe('entradas', () => {
  it('Tesorería con medio=cheque: salta el paso 1 y el primer medio abre con Cheque elegido', async () => {
    mockParams = { socioId: 'c1', medio: 'cheque' }
    renderConQuery(<CobroRoute />)
    await screen.findByText('Paso 2 de 4', {}, ESPERA)
    expect(screen.queryByText('Paso 1 de 4')).toBeNull()
    await presionar('Continuar a medios')
    await presionar('Agregar un medio')
    const cheque = await screen.findByRole('radio', { name: 'Cheque' }, ESPERA)
    expect(cheque.props.accessibilityState.checked).toBe(true)
    expect(screen.getByLabelText('N.º de cheque')).toBeTruthy()
  })
})

import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { RegistrarCobro, AVISO_IMPUTACION } from '../components/RegistrarCobro'
import { COBRO_CON_LO_DE_ANTES, COBRO_YA_ESTABA, SIN_CUENTA_CONFIRMADA } from '../components/CobroListo'
import { leerFecha } from '../lib/cobro'
import { api, ApiError } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, paginaDeMovimientos } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const post = api.postConSobre as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
  { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
  { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
]

const UNA_CAJA = [{ depositoId: 'dep-central', depositoNombre: 'Depósito Central' }]

/** Respuesta del alta del cobro: el id en `data` y lo que el sobre traiga al lado (`tipoCuenta` desde forward-system #868). */
const registrado = (sobre: object = {}) => ({ data: 'p1', sobre: { statusCode: 200, succeeded: true, data: 'p1', ...sobre } })

/** `pagoEn`: la cuenta (`cTst` o `cNor`) cuyos movimientos traen el pago `p1`; con `null`, ninguna. */
function servidor({ pagoEn = 'cNor' as 'cTst' | 'cNor' | null, cajas = UNA_CAJA } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url === '/api/v1/Cajas/abiertas/estado') return cajas
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    if (url.includes('/movimientos')) {
      const conElPago = !!pagoEn && url.startsWith(`/api/v1/cuentas-corrientes/${pagoEn}/movimientos`)
      return paginaDeMovimientos([mov('m1', '2026-10-11T14:00:00Z', { haber: 86400, pagoId: conElPago ? 'p1' : 'otro' })])
    }
    return fichaConCuentas()
  })
}

const pidioMovimientos = () => get.mock.calls.filter(([url]) => String(url).includes('/movimientos')).map(([url]) => String(url))

async function cargarMontoYMedio(monto: string, medio: string) {
  fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), monto)
  await userEvent.press(await screen.findByRole('radio', { name: medio }, ESPERA))
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  servidor()
  post.mockResolvedValue(registrado())
})

it('manda un cobro de una línea sin elegir la cuenta ni imputar: eso lo decide el servidor', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  expect(await screen.findByText(AVISO_IMPUTACION, {}, ESPERA)).toBeTruthy()
  await cargarMontoYMedio('86.400', 'Transferencia')

  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post).toHaveBeenCalledTimes(1)
  const [url, cuerpo] = post.mock.calls[0]
  expect(url).toBe('/api/v1/Finanzas/pagos/multilinea')
  expect(cuerpo).toEqual({ socioComercialId: 'c1', claveIdempotencia: expect.stringMatching(/^mobile-/), lineas: [{ medioPagoId: 'm-tr', monto: 86400 }] })
  expect(cuerpo).not.toHaveProperty('tipoCuenta')
})

describe('idempotencia del cobro (forward-system: claveIdempotencia)', () => {
  const registrar = () => userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  const clavesEnviadas = () => post.mock.calls.map(([, cuerpo]) => cuerpo.claveIdempotencia)
  /** 409 del servidor nuevo: la clave ya registró otro cobro; en `data`, el id del que quedó grabado. */
  const otroCuerpo = (pagoId = 'p1') => Object.assign(
    new ApiError(409, 'Este cobro ya se había registrado antes con otros datos.'),
    { codigo: 'ClaveIdempotenciaConOtroCuerpo', data: pagoId })

  it('manda una clave de idempotencia válida para el servidor (menos de 200 caracteres)', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()

    const [clave] = clavesEnviadas()
    expect(clave).toMatch(/^mobile-/)
    expect(clave.length).toBeLessThan(200)
  })

  it('un reintento tras un corte reusa la misma clave: el servidor no carga el cobro dos veces', async () => {
    post.mockRejectedValueOnce(new TypeError('Network request failed'))
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()
    expect(await screen.findByText('Network request failed', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText('Saldo nuevo')).toBeNull()

    await registrar()

    expect(await screen.findByText('Saldo nuevo', {}, ESPERA)).toBeTruthy()
    expect(post).toHaveBeenCalledTimes(2)
    expect(clavesEnviadas()[1]).toBe(clavesEnviadas()[0])
  })

  it('un reintento tras un rechazo del servidor también reusa la clave (no se grabó nada con ella)', async () => {
    post.mockRejectedValueOnce(new ApiError(400, 'No hay una caja abierta.'))
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()
    expect(await screen.findByText('No hay una caja abierta.', {}, ESPERA)).toBeTruthy()

    await registrar()

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(clavesEnviadas()[1]).toBe(clavesEnviadas()[0])
  })

  it('un cobro nuevo usa una clave nueva', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()
    await userEvent.press(await screen.findByRole('button', { name: 'Registrar otro cobro' }, ESPERA))

    await cargarMontoYMedio('2.000', 'Transferencia')
    await registrar()

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(clavesEnviadas()[1]).toMatch(/^mobile-/)
    expect(clavesEnviadas()[1]).not.toBe(clavesEnviadas()[0])
  })

  it('un reintento idéntico que el servidor ya tenía (200 «operación repetida») se muestra como registrado y avisa que no se cargó de nuevo', async () => {
    post.mockResolvedValue(registrado({
      tipoCuenta: 'Normal',
      message: 'El pago ya había sido registrado con esta clave de idempotencia (operación repetida).',
    }))
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()

    expect(await screen.findByText(COBRO_YA_ESTABA, {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Cobro registrado')).toBeTruthy()
    expect(await screen.findByRole('header', { name: 'Quedó en la cuenta Normal' }, ESPERA)).toBeTruthy()
  })

  it('servidor anterior: ignora la clave y contesta como siempre, sin avisos de reintento', async () => {
    post.mockResolvedValue(registrado({ message: 'Operación registrada con 1 línea(s) por 1.000,00.' }))
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()

    expect(await screen.findByText('Cobro registrado', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText(COBRO_YA_ESTABA)).toBeNull()
    expect(screen.queryByText(COBRO_CON_LO_DE_ANTES)).toBeNull()
  })

  it('409 ClaveIdempotenciaConOtroCuerpo: si tras un corte se cambió el cobro, lleva al que quedó grabado con el aviso y no muestra el monto nuevo', async () => {
    post.mockRejectedValueOnce(new TypeError('Network request failed')).mockRejectedValueOnce(otroCuerpo())
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()
    expect(await screen.findByText('Network request failed', {}, ESPERA)).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Monto'), '2.500')
    await registrar()

    expect(await screen.findByText(COBRO_CON_LO_DE_ANTES, {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Cobro ya registrado')).toBeTruthy()
    // No se mandó otra clave ni se dio por registrado lo que se tipeó después.
    expect(clavesEnviadas()[1]).toBe(clavesEnviadas()[0])
    expect(screen.queryByText(/2\.500/)).toBeNull()
    // La cuenta del cobro grabado se busca por su id, como con un servidor viejo.
    expect(await screen.findByRole('header', { name: 'Quedó en la cuenta Normal' }, ESPERA)).toBeTruthy()
    expect(screen.getByText('Saldo nuevo')).toBeTruthy()
  })

  // Tras un intento sin respuesta, editar CUALQUIER campo no cambia la clave: el servidor decide con un 409.
  const editarMonto = () => fireEvent.changeText(screen.getByLabelText('Monto'), '2.500')
  const editarReferencia = () => fireEvent.changeText(screen.getByLabelText('Referencia (opcional)'), 'Recibo 0042')
  const editarMedio = async () => {
    await userEvent.press(screen.getByRole('radio', { name: 'Efectivo' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Registrar cobro de/ }).props.accessibilityState?.disabled).toBeFalsy(), ESPERA)
  }
  it.each([
    ['el monto', editarMonto],
    ['la referencia', editarReferencia],
    ['el medio de pago', editarMedio],
  ])('tras un corte, si se edita %s la clave es la misma y el 409 dice que lo nuevo NO se guardó', async (_campo, editar) => {
    post.mockRejectedValueOnce(new TypeError('Network request failed')).mockRejectedValueOnce(otroCuerpo())
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()
    expect(await screen.findByText('Network request failed', {}, ESPERA)).toBeTruthy()

    await editar()
    await registrar()

    expect(await screen.findByText(COBRO_CON_LO_DE_ANTES, {}, ESPERA)).toBeTruthy()
    expect(COBRO_CON_LO_DE_ANTES).toMatch(/datos de antes.*NO se guardaron/)
    expect(screen.getByText('Cobro ya registrado')).toBeTruthy()
    expect(post).toHaveBeenCalledTimes(2)
    expect(clavesEnviadas()[1]).toBe(clavesEnviadas()[0])
  })

  it('tras un corte, si se edita un dato del cheque la clave es la misma y el 409 dice que lo nuevo NO se guardó', async () => {
    post.mockRejectedValueOnce(new TypeError('Network request failed')).mockRejectedValueOnce(otroCuerpo())
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('30.000', 'Cheque')
    fireEvent.changeText(screen.getByLabelText('N.º de cheque'), '00412377')
    fireEvent.changeText(screen.getByLabelText('Banco'), 'Banco Provincia')
    fireEvent.changeText(screen.getByLabelText('Titular'), 'Graciela Ruiz')
    await registrar()
    expect(await screen.findByText('Network request failed', {}, ESPERA)).toBeTruthy()

    fireEvent.changeText(screen.getByLabelText('N.º de cheque'), '99999999')
    await registrar()

    expect(await screen.findByText(COBRO_CON_LO_DE_ANTES, {}, ESPERA)).toBeTruthy()
    expect(post.mock.calls[1][1].lineas[0].chequesRecibidos[0].numero).toBe('99999999')
    expect(clavesEnviadas()[1]).toBe(clavesEnviadas()[0])
  })

  /** 409 de la clave de OTRO socio: el servidor no devuelve ningún dato del pago (`data` es el Guid vacío). */
  const claveDeOtroSocio = () => Object.assign(
    new ApiError(409, 'Esta clave de idempotencia ya se usó en otra operación. No se registró nada: probá con un cobro nuevo.'),
    { codigo: 'ClaveIdempotenciaConOtroCuerpo', data: '00000000-0000-0000-0000-000000000000' })

  it('409 con la clave de otro socio: muestra el motivo del servidor, no da nada por registrado y la próxima vez usa otra clave', async () => {
    post.mockRejectedValueOnce(claveDeOtroSocio())
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()

    expect(await screen.findByText(/Esta clave de idempotencia ya se usó en otra operación/, {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText('Saldo nuevo')).toBeNull()
    expect(screen.queryByText('Cobro ya registrado')).toBeNull()

    await registrar()

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(clavesEnviadas()[1]).not.toBe(clavesEnviadas()[0])
  })

  it('409 con el cobro anulado: lo dice con el mensaje del servidor, sin "registrado" ni cuenta, y «Registrar otro cobro» usa otra clave', async () => {
    const MENSAJE = 'Este cobro ya se había registrado con esta clave y después se anuló. No se registró uno nuevo: si hace falta cobrar de nuevo, registrá un cobro nuevo.'
    post.mockRejectedValueOnce(Object.assign(new ApiError(409, MENSAJE), { codigo: 'ClaveIdempotenciaConOtroCuerpo', data: 'p1' }))
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()

    expect(await screen.findByText(MENSAJE, {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Cobro anulado')).toBeTruthy()
    expect(screen.queryByText('Cobro registrado')).toBeNull()
    expect(screen.queryByText(COBRO_CON_LO_DE_ANTES)).toBeNull()
    expect(screen.queryByText(/Quedó en la cuenta/)).toBeNull()
    expect(screen.queryByText(SIN_CUENTA_CONFIRMADA)).toBeNull()
    expect(pidioMovimientos()).toEqual([])

    await userEvent.press(screen.getByRole('button', { name: 'Registrar otro cobro' }))
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(clavesEnviadas()[1]).not.toBe(clavesEnviadas()[0])
  })

  it('un 409 sin el código de la clave (p. ej. conflicto de concurrencia) es un error común: no se da el cobro por registrado', async () => {
    post.mockRejectedValueOnce(new ApiError(409, 'Conflicto de concurrencia al actualizar el saldo. Reintentá la operación.'))
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await cargarMontoYMedio('1.000', 'Transferencia')
    await registrar()

    expect(await screen.findByText('Conflicto de concurrencia al actualizar el saldo. Reintentá la operación.', {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText('Saldo nuevo')).toBeNull()
  })
})

it('servidor nuevo: dice la cuenta que trae la respuesta del cobro, sin buscarla en los movimientos', async () => {
  // Los movimientos dirían Normal: si la pantalla los usara en vez de la respuesta, se notaría.
  post.mockResolvedValue(registrado({ tipoCuenta: 'Tst' }))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('86400', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByRole('header', { name: 'Quedó en la cuenta TST' }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Saldo nuevo')).toBeTruthy()
  expect(screen.queryByText(SIN_CUENTA_CONFIRMADA)).toBeNull()
  // Solo se leen los movimientos de la cuenta TST para saber a qué se imputó; la Normal no se mira.
  expect(pidioMovimientos().some(url => url.includes('/cNor/') || url.includes('cuenta=Normal'))).toBe(false)
})

it.each([
  ['servidor viejo: sin tipoCuenta en la respuesta', {}, 'cNor', 'Normal'],
  // El pago está en TST: si se tomara 'Otra' como cuenta, la pantalla diría Normal sin buscar.
  ['un tipoCuenta que mobile no conoce', { tipoCuenta: 'Otra' }, 'cTst', 'TST'],
] as const)('%s: busca el pago en los movimientos y dice la cuenta donde está', async (_caso, sobre, pagoEn, cuenta) => {
  servidor({ pagoEn })
  post.mockResolvedValue(registrado(sobre))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('86400', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByRole('header', { name: `Quedó en la cuenta ${cuenta}` }, ESPERA)).toBeTruthy()
  expect(screen.getByText('Saldo nuevo')).toBeTruthy()
  expect(pidioMovimientos()).toContainEqual(expect.stringContaining(`/cuentas-corrientes/${pagoEn}/movimientos`))
})

it('un 2xx sin id del pago: el cobro se da por registrado, sin cuenta confirmada y sin buscar en los movimientos', async () => {
  post.mockResolvedValue({ data: undefined, sobre: null })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Transferencia')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByText('Cobro registrado', {}, ESPERA)).toBeTruthy()
  expect(await screen.findByText(SIN_CUENTA_CONFIRMADA, {}, ESPERA)).toBeTruthy()
  expect(screen.queryByText(/Quedó en la cuenta/)).toBeNull()
  expect(pidioMovimientos()).toEqual([])
})

it('servidor viejo: si el pago no aparece en ninguna cuenta, no inventa una: lo dice', async () => {
  servidor({ pagoEn: null })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByText(SIN_CUENTA_CONFIRMADA, {}, ESPERA)).toBeTruthy()
  expect(screen.queryByText(/Quedó en la cuenta/)).toBeNull()
})

it('con cheque pide sus datos y los manda como cheque recibido, con las fechas del día argentino', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('30.000', 'Cheque')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(screen.getByText('Completá número, banco y titular del cheque.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()

  fireEvent.changeText(screen.getByLabelText('N.º de cheque'), '00412377')
  fireEvent.changeText(screen.getByLabelText('Banco'), 'Banco Provincia')
  fireEvent.changeText(screen.getByLabelText('Titular'), 'Graciela Ruiz')
  fireEvent.changeText(screen.getByLabelText('Fecha de emisión'), '7/10/2026')
  fireEvent.changeText(screen.getByLabelText('Fecha de pago'), '20/10/2026')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1].lineas).toEqual([{
    medioPagoId: 'm-ch',
    monto: 30000,
    chequesRecibidos: [{ numero: '00412377', banco: 'Banco Provincia', titular: 'Graciela Ruiz', fechaEmision: '2026-10-07', fechaPago: '2026-10-20', monto: 30000 }],
  }])
})

it('si el servidor rechaza, se ve su motivo y el cobro no se da por hecho', async () => {
  post.mockRejectedValue(Object.assign(new Error('No hay una caja abierta.'), { errors: [] }))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(await screen.findByText('No hay una caja abierta.', {}, ESPERA)).toBeTruthy()
  expect(screen.queryByText('Saldo nuevo')).toBeNull()
})

it('mientras se registra, un segundo toque no manda otro cobro', async () => {
  let terminar: (v: unknown) => void = () => {}
  post.mockImplementation(() => new Promise(r => { terminar = r }))
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')
  const boton = screen.getByRole('button', { name: /^Registrar cobro de/ })

  await userEvent.press(boton)
  await userEvent.press(boton)
  terminar(registrado())

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
})

it('lee fechas dd/mm/aaaa y rechaza las que no existen', () => {
  expect(leerFecha('07/10/2026')).toBe('2026-10-07')
  expect(leerFecha('31/02/2026')).toBeNull()
  expect(leerFecha('2026-10-07')).toBeNull()
})

it('un cobro en efectivo manda el depósito de la única caja abierta', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('5.000', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1]).toEqual({
    socioComercialId: 'c1', depositoId: 'dep-central', claveIdempotencia: expect.stringMatching(/^mobile-/), lineas: [{ medioPagoId: 'm-ef', monto: 5000 }],
  })
})

it('con dos cajas abiertas obliga a elegir la caja y manda esa', async () => {
  servidor({ cajas: [...UNA_CAJA, { depositoId: 'dep-sur', depositoNombre: 'Depósito Sur' }] })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('5.000', 'Efectivo')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(screen.getByText('Elegí en qué caja entra el efectivo.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()

  await userEvent.press(await screen.findByRole('radio', { name: 'Depósito Sur' }, ESPERA))
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1].depositoId).toBe('dep-sur')
})

it('un medio que no va a caja no manda depósito', async () => {
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('5.000', 'Transferencia')
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

  expect(post.mock.calls[0][1]).not.toHaveProperty('depositoId')
})

it('con efectivo, no se puede registrar mientras cargan las cajas abiertas: no sale un cobro sin caja', async () => {
  let cargar: (v: unknown) => void = () => {}
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/Cajas/abiertas/estado') return new Promise(r => { cargar = r })
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    return fichaConCuentas()
  })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')

  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post).not.toHaveBeenCalled()

  cargar(UNA_CAJA)
  await waitFor(() => expect(screen.getByRole('button', { name: /^Registrar cobro de/ }).props.accessibilityState?.disabled).toBeFalsy(), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post.mock.calls[0][1].depositoId).toBe('dep-central')
})

it('si falla la carga de cajas, lo dice con Reintentar y no manda el cobro; al reintentar, cobra con su caja', async () => {
  let falla = true
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/Cajas/abiertas/estado') {
      if (falla) throw new Error('No se pudo leer las cajas.')
      return UNA_CAJA
    }
    if (url === '/api/v1/gastos/medios-pago') return MEDIOS
    if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
    return fichaConCuentas()
  })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')

  expect(await screen.findByText('No se pudo leer las cajas.', {}, ESPERA)).toBeTruthy()
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post).not.toHaveBeenCalled()

  falla = false
  await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(screen.queryByText('No se pudo leer las cajas.') === null).toBe(true), ESPERA)
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post.mock.calls[0][1].depositoId).toBe('dep-central')
})

it('con efectivo y ninguna caja abierta, avisa y no manda el cobro', async () => {
  servidor({ cajas: [] })
  renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
  await cargarMontoYMedio('100', 'Efectivo')

  expect(await screen.findByText('No hay ninguna caja abierta. Abrí una caja para registrar cobros en efectivo.', {}, ESPERA)).toBeTruthy()
  await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))
  expect(post).not.toHaveBeenCalled()
})

describe('R11 cobro: resumen "Cobrás" y "Todo lo vencido" (solo pantalla: el cobro se manda igual)', () => {
  const conVencido = (deudaVencida: number) => {
    servidor()
    const base = get.getMockImplementation()!
    get.mockImplementation(async (url: string) => (url.endsWith('/estado-cuenta') ? estadoDeCuenta({ tieneDeudaVencida: deudaVencida > 0, deudaVencida }) : base(url)))
  }

  it('Cobrás muestra lo que se tipea en el monto', async () => {
    servidor()
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)

    fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), '84.300')

    expect(await screen.findByLabelText('Cobrás: $ 84.300,00', {}, ESPERA)).toBeTruthy()
  })

  it('Todo lo vencido carga la deuda vencida en el monto y el cobro se manda con ese monto, sin campos nuevos', async () => {
    conVencido(84300)
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)

    await userEvent.press(await screen.findByRole('button', { name: 'Todo lo vencido' }, ESPERA))
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await userEvent.press(screen.getByRole('button', { name: /^Registrar cobro de/ }))

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][1]).toEqual({ socioComercialId: 'c1', claveIdempotencia: expect.stringMatching(/^mobile-/), lineas: [{ medioPagoId: 'm-tr', monto: 84300 }] })
  })

  it('sin deuda vencida no hay "Todo lo vencido"', async () => {
    conVencido(0)
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    await screen.findByLabelText('Monto', {}, ESPERA)
    await screen.findByLabelText(/^Saldo del cliente/, {}, ESPERA)

    expect(screen.queryByRole('button', { name: 'Todo lo vencido' })).toBeNull()
  })
})

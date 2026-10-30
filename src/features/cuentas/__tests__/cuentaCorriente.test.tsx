import React from 'react'
import { fireEvent, screen, userEvent, within } from '@testing-library/react-native'
import { CuentaCorrienteCliente } from '../components/CuentaCorrienteCliente'
import { api } from '@/core/api/client'
import { formatImporte as $ } from '@/core/ui/fw'
import { MOTIVO_SIN_PERMISO_DE_COBRO } from '@/core/ui/fw/MotivoDeshabilitado'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas, mov, movSocio, noEncontrado, paginaDeMovimientos, paginaDeMovimientosSocio } from '../__testing__/servidor'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))

const get = api.get as jest.Mock
/** La primera pantalla de la suite tarda en montar cuando corre el suite completo en paralelo. */
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const urls = () => get.mock.calls.map(([u]) => String(u))

/** Respuesta del endpoint nuevo para la URL pedida; sin esto, el servidor es anterior y contesta 404. */
type MovimientosDelSocio = (url: string) => unknown

function servidor({ ficha = fichaConCuentas(), tstPaginas = 1, estado = estadoDeCuenta(), socioMovs }: { ficha?: object; tstPaginas?: number; estado?: object; socioMovs?: MovimientosDelSocio } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/estado-cuenta')) return estado
    if (url.startsWith('/api/v1/cuentas-corrientes/socios/c1/movimientos')) {
      if (!socioMovs) throw noEncontrado()
      return socioMovs(url)
    }
    if (url.startsWith('/api/v1/cuentas-corrientes/cTst/movimientos')) {
      return url.includes('pageNumber=2')
        ? paginaDeMovimientos([mov('t0', '2026-08-01T12:00:00Z', { referencia: 'Venta A00300 entregada', debe: 5000, saldoHistorico: 5000 })], 2, 2)
        : paginaDeMovimientos([mov('t1', '2026-09-30T12:00:00Z', { referencia: 'Cobro', haber: 66940, saldoHistorico: 132020, medioPagoNombre: 'Transferencia' })], 1, tstPaginas)
    }
    if (url.startsWith('/api/v1/cuentas-corrientes/cNor/movimientos')) {
      return paginaDeMovimientos([mov('n1', '2026-10-02T12:00:00Z', { referencia: 'Venta A00409 entregada', debe: 84400, saldoHistorico: 216420 })])
    }
    return ficha
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_CC', canRead: true }])
  servidor()
})

it('muestra el saldo con el desglose TST / Normal que da el servidor', async () => {
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  expect(await screen.findByLabelText(`Saldo: ${$(186420)}`, {}, ESPERA)).toBeTruthy()
  expect(screen.getByLabelText(`Cuenta TST: ${$(132020)}`)).toBeTruthy()
  expect(screen.getByLabelText(`Cuenta Normal (con factura): ${$(54400)}`)).toBeTruthy()
  expect(screen.getByLabelText(`Tope de crédito: ${$(300000)}`)).toBeTruthy()
  expect(urls()).toContain('/api/v1/cuentas-corrientes/socios/c1/estado-cuenta')
})

it('los movimientos de las dos cuentas van juntos y cada uno dice en qué cuenta está', async () => {
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  const venta = await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)
  expect(venta.props.accessibilityLabel).toContain('Cuenta Normal')
  expect(venta.props.accessibilityLabel).toContain(`+ ${$(84400)}`)
  const cobro = screen.getByLabelText(/Cobro/)
  expect(cobro.props.accessibilityLabel).toContain('Cuenta TST')
  expect(cobro.props.accessibilityLabel).toContain(`− ${$(66940)}`)
  expect(within(cobro).getByText('Transferencia')).toBeTruthy()
})

it('con el filtro TST solo quedan los movimientos de esa cuenta', async () => {
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)

  await userEvent.press(screen.getByRole('radio', { name: 'TST' }))

  expect(screen.getByLabelText(/Cobro/)).toBeTruthy()
  expect(screen.queryByLabelText(/Venta A00409 entregada/)).toBeNull()
})

it('Ver movimientos anteriores pide la página siguiente al servidor', async () => {
  servidor({ tstPaginas: 2 })
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(/Cobro/, {}, ESPERA)

  await userEvent.press(screen.getByRole('button', { name: 'Ver movimientos anteriores' }))

  expect(await screen.findByLabelText(/Venta A00300 entregada/, {}, ESPERA)).toBeTruthy()
  expect(urls()).toContain('/api/v1/cuentas-corrientes/cTst/movimientos?pageNumber=2&pageSize=20')
})

it('si el servidor no deja ver la cuenta, no se pide ni el estado ni los movimientos', async () => {
  servidor({ ficha: fichaConCuentas({ puedeVerCuentaCorriente: false, cuentaId: null, cuentaNormalId: null }) })
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  expect(await screen.findByText('No tenés acceso a la cuenta corriente de este cliente.', {}, ESPERA)).toBeTruthy()
  expect(urls().some(u => u.includes('estado-cuenta') || u.includes('/movimientos'))).toBe(false)
})

it('si el servidor rechaza los movimientos, se ve su mensaje', async () => {
  get.mockImplementation(async (url: string) => {
    if (url.includes('/movimientos')) throw new Error('No tenés permisos para esta acción.')
    return url.endsWith('/estado-cuenta') ? estadoDeCuenta() : fichaConCuentas()
  })
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

  expect(await screen.findByText('No tenés permisos para esta acción.', {}, ESPERA)).toBeTruthy()
})

it('Registrar cobro con permiso para crear pagos abre el cobro de este cliente; sin él se ve deshabilitado con el motivo (como la web)', async () => {
  const { unmount } = renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(`Saldo: ${$(186420)}`, {}, ESPERA)
  const sinPermiso = screen.getByRole('button', { name: 'Cobrar' })
  expect(sinPermiso.props.accessibilityState?.disabled).toBe(true)
  expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_COBRO)).toBeTruthy()
  await userEvent.press(sinPermiso)
  expect(mockPush).not.toHaveBeenCalled()
  unmount()

  conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await userEvent.press(await screen.findByRole('button', { name: 'Cobrar' }, ESPERA))

  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: 'c1' } })
})

it('Registrar cobro queda deshabilitado, con el motivo, sin MOD_PAGOS:Read o sin MOD_PAGOS:Create: la pantalla de cobro pide medios y cajas', async () => {
  conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canCreate: true }])
  const a = renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(`Saldo: ${$(186420)}`, {}, ESPERA)
  expect(screen.getByRole('button', { name: 'Cobrar' }).props.accessibilityState?.disabled).toBe(true)
  expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_COBRO)).toBeTruthy()
  a.unmount()

  conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true }])
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(`Saldo: ${$(186420)}`, {}, ESPERA)
  expect(screen.getByRole('button', { name: 'Cobrar' }).props.accessibilityState?.disabled).toBe(true)
  expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_COBRO)).toBeTruthy()
})

it('con permiso de cobro no se muestra ningún motivo', async () => {
  conPermisos([{ module: 'MOD_CC', canRead: true }, { module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
  await screen.findByLabelText(`Saldo: ${$(186420)}`, {}, ESPERA)
  expect(screen.queryByText(MOTIVO_SIN_PERMISO_DE_COBRO)).toBeNull()
})

describe('vencido y disponible (servidor con PR #882)', () => {
  it('lo vencido en las dos cuentas se ve con el importe de cada una, y el disponible', async () => {
    servidor({ estado: estadoDeCuenta({ tieneDeudaVencida: true, deudaVencida: 100000, deudaVencidaTst: 60000, deudaVencidaNormal: 40000, creditoDisponible: 5000 }) })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    expect(await screen.findByLabelText(`Vencido (más de 30 días): ${$(100000)} · TST ${$(60000)} · Normal ${$(40000)}`, {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText(`Disponible: ${$(5000)}`)).toBeTruthy()
    expect(screen.getByText(/los pedidos nuevos van a quedar por autorizar/)).toBeTruthy()
  })

  it('con un servidor anterior, la cuenta se ve como antes: sin vencido ni disponible', async () => {
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    await screen.findByLabelText(`Saldo: ${$(186420)}`, {}, ESPERA)
    expect(screen.queryByText(/Vencido|Disponible|Pasado del tope|por autorizar/)).toBeNull()
  })
})

describe('movimientos de las dos cuentas en un solo endpoint (servidor con PR #905)', () => {
  const RUTA = '/api/v1/cuentas-corrientes/socios/c1/movimientos'
  const pedidasAlSocio = () => urls().filter(u => u.startsWith(RUTA))
  const pedidasPorCuenta = () => urls().filter(u => /cuentas-corrientes\/c(Tst|Nor)\/movimientos/.test(u))

  const primera = () => paginaDeMovimientosSocio([
    movSocio('n1', '2026-10-02T12:00:00Z', {
      cuenta: 'Normal', referencia: 'Entrega de Venta', comprobante: 'A00409', debe: 84400, saldoHistorico: 216420, vencimiento: '2026-11-01',
    }),
    movSocio('t1', '2026-09-30T12:00:00Z', {
      tipo: 'Pago', cuenta: 'Tst', referencia: 'Cobro', haber: 66940, saldoHistorico: 132020,
      imputadoA: [{ comprobante: 'A00300', monto: 50000 }, { comprobante: 'A00301', monto: 16940 }],
    }),
  ], 1, 2)

  const conSegunda = (url: string) => url.includes('pageNumber=2')
    ? paginaDeMovimientosSocio([movSocio('t0', '2026-08-01T12:00:00Z', { referencia: 'Venta vieja', debe: 5000 })], 2, 2)
    : primera()

  const cerca = { nativeEvent: { layoutMeasurement: { height: 800 }, contentOffset: { y: 900 }, contentSize: { height: 1800 } } }
  const lejos = { nativeEvent: { layoutMeasurement: { height: 800 }, contentOffset: { y: 0 }, contentSize: { height: 1800 } } }

  it('pide los movimientos por el socio, una sola vez, y no los pide cuenta por cuenta', async () => {
    servidor({ socioMovs: primera })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    await screen.findByLabelText(/Entrega de Venta/, {}, ESPERA)

    expect(pedidasAlSocio()).toEqual([`${RUTA}?pageNumber=1&pageSize=20`])
    expect(pedidasPorCuenta()).toEqual([])
  })

  it('cada movimiento muestra la fecha, la cuenta, el concepto con su comprobante y el importe', async () => {
    servidor({ socioMovs: primera })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    const venta = await screen.findByLabelText(/Entrega de Venta/, {}, ESPERA)

    expect(venta.props.accessibilityLabel).toContain('Cuenta Normal')
    expect(venta.props.accessibilityLabel).toContain('Entrega de Venta · A00409')
    expect(venta.props.accessibilityLabel).toContain(`+ ${$(84400)}`)
    expect(within(venta).getByText('Entrega de Venta · A00409')).toBeTruthy()
    const cobro = screen.getByLabelText(/Cobro/)
    expect(cobro.props.accessibilityLabel).toContain('Cuenta TST')
    expect(cobro.props.accessibilityLabel).toContain(`− ${$(66940)}`)
  })

  it('una deuda impaga dice cuándo vence y un cobro dice a qué se imputó', async () => {
    servidor({ socioMovs: primera })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    const venta = await screen.findByLabelText(/Entrega de Venta/, {}, ESPERA)
    const cobro = screen.getByLabelText(/Cobro/)

    expect(within(venta).getByText('Vence 1 nov')).toBeTruthy()
    expect(venta.props.accessibilityLabel).toContain('Vence 1 nov')
    expect(within(cobro).getByText('Imputado a A00300, A00301')).toBeTruthy()
    expect(cobro.props.accessibilityLabel).toContain('Imputado a A00300, A00301')
    expect(within(venta).queryByText(/Imputado a/)).toBeNull()
    expect(within(cobro).queryByText(/Vence/)).toBeNull()
  })

  it('con más de tres comprobantes, resume los que faltan', async () => {
    servidor({
      socioMovs: () => paginaDeMovimientosSocio([
        movSocio('t1', '2026-09-30T12:00:00Z', {
          tipo: 'Pago', referencia: 'Cobro', haber: 100,
          imputadoA: ['A1', 'A2', 'A3', 'A4', 'A5'].map(comprobante => ({ comprobante, monto: 20 })),
        }),
      ]),
    })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    expect(await screen.findByText('Imputado a A1, A2, A3 y 2 más', {}, ESPERA)).toBeTruthy()
  })

  it('lo que no vence ni se imputó no muestra esas líneas', async () => {
    servidor({
      socioMovs: () => paginaDeMovimientosSocio([
        movSocio('n1', '2026-10-02T12:00:00Z', { referencia: 'Entrega de Venta', debe: 100, vencimiento: null }),
        movSocio('t1', '2026-09-30T12:00:00Z', { tipo: 'Pago', referencia: 'Cobro a cuenta', haber: 100, imputadoA: [] }),
      ]),
    })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    await screen.findByLabelText(/Cobro a cuenta/, {}, ESPERA)

    expect(screen.queryByText(/Vence|Imputado a/)).toBeNull()
  })

  it('al llegar cerca del final de la lista pide la página siguiente, una sola vez', async () => {
    servidor({ socioMovs: conSegunda })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
    await screen.findByLabelText(/Cobro/, {}, ESPERA)
    const lista = screen.getByTestId('cuenta-corriente-scroll')

    fireEvent.scroll(lista, lejos)
    expect(pedidasAlSocio()).toHaveLength(1)

    fireEvent.scroll(lista, cerca)
    fireEvent.scroll(lista, cerca)

    expect(await screen.findByLabelText(/Venta vieja/, {}, ESPERA)).toBeTruthy()
    expect(pedidasAlSocio()).toEqual([`${RUTA}?pageNumber=1&pageSize=20`, `${RUTA}?pageNumber=2&pageSize=20`])
  })

  it('en la última página, desplazarse no pide nada más', async () => {
    servidor({ socioMovs: () => paginaDeMovimientosSocio([movSocio('t1', '2026-09-30T12:00:00Z', { referencia: 'Cobro', haber: 1 })]) })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
    await screen.findByLabelText(/Cobro/, {}, ESPERA)

    fireEvent.scroll(screen.getByTestId('cuenta-corriente-scroll'), cerca)

    expect(pedidasAlSocio()).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Ver movimientos anteriores' })).toBeNull()
  })

  it('Ver movimientos anteriores sigue pidiendo la página siguiente', async () => {
    servidor({ socioMovs: conSegunda })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
    await screen.findByLabelText(/Cobro/, {}, ESPERA)

    await userEvent.press(screen.getByRole('button', { name: 'Ver movimientos anteriores' }))

    expect(await screen.findByLabelText(/Venta vieja/, {}, ESPERA)).toBeTruthy()
  })

  it('el filtro de cuenta se lo pide al servidor, que pagina solo esa cuenta', async () => {
    servidor({
      socioMovs: url => url.includes('cuenta=Normal')
        ? paginaDeMovimientosSocio([movSocio('n1', '2026-10-02T12:00:00Z', { cuenta: 'Normal', referencia: 'Entrega de Venta', debe: 1 })])
        : primera(),
    })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
    await screen.findByLabelText(/Cobro/, {}, ESPERA)

    await userEvent.press(screen.getByRole('radio', { name: 'Normal' }))

    expect(await screen.findByLabelText(/Entrega de Venta/, {}, ESPERA)).toBeTruthy()
    expect(screen.queryByLabelText(/Cobro/)).toBeNull()
    expect(pedidasAlSocio()).toContain(`${RUTA}?pageNumber=1&pageSize=20&cuenta=Normal`)
    expect(pedidasPorCuenta()).toEqual([])
  })

  it('si la primera página falla con un 500, la pantalla cae al camino de antes y no vuelve a probar el endpoint nuevo', async () => {
    servidor({ socioMovs: () => { throw Object.assign(new Error('Error interno del servidor.'), { status: 500 }) } })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    expect(await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)).toBeTruthy()
    expect(screen.getByLabelText(/Cobro/)).toBeTruthy()
    expect(screen.queryByText('Error interno del servidor.')).toBeNull()

    await userEvent.press(screen.getByRole('radio', { name: 'TST' }))
    await userEvent.press(screen.getByRole('radio', { name: 'Normal' }))

    expect(pedidasAlSocio()).toHaveLength(1)
    expect(pedidasPorCuenta().length).toBeGreaterThan(0)
  })

  it('si la primera página falla por la red, la pantalla cae al camino de antes', async () => {
    servidor({ socioMovs: () => { throw new TypeError('Network request failed') } })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    expect(await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText(/Network request failed/)).toBeNull()
  })

  it('un 403 del endpoint nuevo también cae al camino de antes, que muestra el motivo si lo rechaza igual', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.includes('/movimientos')) throw Object.assign(new Error('No tenés permisos para ver la cuenta corriente de este socio.'), { status: 403 })
      return url.endsWith('/estado-cuenta') ? estadoDeCuenta() : fichaConCuentas()
    })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    expect(await screen.findByText('No tenés permisos para ver la cuenta corriente de este socio.', {}, ESPERA)).toBeTruthy()
    expect(pedidasPorCuenta().length).toBeGreaterThan(0)
  })

  describe('cuando falla la página siguiente', () => {
    let falla = true
    const conFallaEnLaSegunda = (url: string) => {
      if (url.includes('pageNumber=2')) {
        if (falla) throw Object.assign(new Error('Sin conexión.'), { status: 500 })
        return paginaDeMovimientosSocio([movSocio('t0', '2026-08-01T12:00:00Z', { referencia: 'Venta vieja', debe: 5000 })], 2, 2)
      }
      return primera()
    }
    beforeEach(() => { falla = true })

    it('se conserva la lista, se ofrece Reintentar y el desplazamiento no insiste', async () => {
      servidor({ socioMovs: conFallaEnLaSegunda })
      renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
      await screen.findByLabelText(/Cobro/, {}, ESPERA)
      const lista = screen.getByTestId('cuenta-corriente-scroll')

      fireEvent.scroll(lista, cerca)

      expect(await screen.findByRole('button', { name: 'Reintentar' }, ESPERA)).toBeTruthy()
      expect(screen.getByLabelText(/Entrega de Venta/)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Ver movimientos anteriores' })).toBeNull()
      const antes = pedidasAlSocio().length

      fireEvent.scroll(lista, cerca)
      fireEvent.scroll(lista, cerca)

      expect(pedidasAlSocio()).toHaveLength(antes)
    })

    it('Reintentar vuelve a pedir la página y, si anda, la suma', async () => {
      servidor({ socioMovs: conFallaEnLaSegunda })
      renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
      await screen.findByLabelText(/Cobro/, {}, ESPERA)
      fireEvent.scroll(screen.getByTestId('cuenta-corriente-scroll'), cerca)
      const reintentar = await screen.findByRole('button', { name: 'Reintentar' }, ESPERA)
      falla = false

      await userEvent.press(reintentar)

      expect(await screen.findByLabelText(/Venta vieja/, {}, ESPERA)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
    })
  })

  it('un movimiento repetido por el corrimiento del offset aparece una sola vez', async () => {
    servidor({
      socioMovs: url => url.includes('pageNumber=2')
        ? paginaDeMovimientosSocio([
            movSocio('t1', '2026-09-30T12:00:00Z', { tipo: 'Pago', referencia: 'Cobro', haber: 66940 }),
            movSocio('t0', '2026-08-01T12:00:00Z', { referencia: 'Venta vieja', debe: 5000 }),
          ], 2, 2)
        : primera(),
    })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
    await screen.findByLabelText(/Cobro/, {}, ESPERA)

    await userEvent.press(screen.getByRole('button', { name: 'Ver movimientos anteriores' }))

    expect(await screen.findByLabelText(/Venta vieja/, {}, ESPERA)).toBeTruthy()
    expect(screen.getAllByLabelText(/Cobro/)).toHaveLength(1)
  })

  it('si el servidor no deja ver la cuenta, no se pide el endpoint nuevo', async () => {
    servidor({ socioMovs: primera, ficha: fichaConCuentas({ puedeVerCuentaCorriente: false, cuentaId: null, cuentaNormalId: null }) })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    await screen.findByText('No tenés acceso a la cuenta corriente de este cliente.', {}, ESPERA)

    expect(pedidasAlSocio()).toEqual([])
  })
})

describe('servidor anterior, sin el endpoint de movimientos del socio (404)', () => {
  const RUTA = '/api/v1/cuentas-corrientes/socios/c1/movimientos'

  it('la pantalla queda como antes: las dos cuentas por separado, sin vencimiento ni imputación', async () => {
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    const venta = await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)
    expect(venta.props.accessibilityLabel).toContain('Cuenta Normal')
    const cobro = screen.getByLabelText(/Cobro/)
    expect(within(cobro).getByText('Transferencia')).toBeTruthy()
    expect(screen.queryByText(/Vence|Imputado a/)).toBeNull()
    expect(urls()).toEqual(expect.arrayContaining([
      '/api/v1/cuentas-corrientes/cTst/movimientos?pageNumber=1&pageSize=20',
      '/api/v1/cuentas-corrientes/cNor/movimientos?pageNumber=1&pageSize=20',
    ]))
  })

  it('el 404 se espera: se pide como esperado y una sola vez, aunque se cambie de cuenta', async () => {
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)
    await screen.findByLabelText(/Venta A00409 entregada/, {}, ESPERA)

    await userEvent.press(screen.getByRole('radio', { name: 'TST' }))
    await userEvent.press(screen.getByRole('radio', { name: 'Normal' }))

    const sondeos = get.mock.calls.filter(([u]) => String(u).startsWith(RUTA))
    expect(sondeos).toHaveLength(1)
    expect(sondeos[0][1]).toEqual({ estadosEsperados: [404] })
    expect(await screen.findByLabelText(/Venta A00409 entregada/)).toBeTruthy()
    expect(screen.queryByLabelText(/Cobro/)).toBeNull()
  })

  it('una respuesta que no es una página tampoco rompe la pantalla: se usa el camino de antes', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.startsWith(RUTA)) return { algo: 'raro' }
      if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
      if (url.startsWith('/api/v1/cuentas-corrientes/cTst/movimientos')) return paginaDeMovimientos([mov('t1', '2026-09-30T12:00:00Z', { referencia: 'Cobro', haber: 1 })])
      if (url.startsWith('/api/v1/cuentas-corrientes/cNor/movimientos')) return paginaDeMovimientos([])
      return fichaConCuentas()
    })
    renderConQuery(<CuentaCorrienteCliente socioId="c1" />)

    expect(await screen.findByLabelText(/Cobro/, {}, ESPERA)).toBeTruthy()
  })
})

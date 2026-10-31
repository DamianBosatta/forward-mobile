import React from 'react'
import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { AVISO_COBRO_DE_CLIENTE, Transferencia } from '../components/Transferencia'
import { MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA } from '@/core/ui/fw/MotivoDeshabilitado'
import TesoreriaScreen from '../../../../app/(tabs)/tesoreria/index'
import { api, ApiError } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/ui/fw/useMenuLeading', () => ({ useMenuLeading: () => undefined }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)
const cuenta = (id: string, nombre: string, saldoActual: number) => ({
  id, nombre, saldoActual, esPrincipal: false, activo: true, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false, puedeVerMovimientos: true,
})

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }])
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/movimientos-internos/tipos') return [{ id: 't-tr', nombre: 'Transferencia', activo: true }, { id: 't-re', nombre: 'Retiro', activo: true }]
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return [cuenta('caja', 'Caja de Emanuel', 412300), cuenta('gal', 'Banco Galicia', 2184950.4)]
    throw new Error(`sin respuesta para ${url}`)
  })
  post.mockResolvedValue('mi1')
})

const radio = (grupo: string, nombre: RegExp) => within(screen.getByLabelText(grupo)).getByRole('radio', { name: nombre })

const PARA_COBRAR = '/api/v1/cuentas-corrientes/propias/para-cobrar'
const VIEJO = new ApiError(404, 'No encontrado')
/** La lista liviana (`propias/para-cobrar`): sin saldos. */
const liviana = (id: string, nombre: string) => ({ id, nombre, moneda: 'ARS', esPrincipal: false, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false })

/** Servidor con la lista liviana y `saldo-restante`; `viejo` = anterior a los dos (404). */
function servidorNuevo({ viejo = false } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/movimientos-internos/tipos') return [{ id: 't-tr', nombre: 'Transferencia', activo: true }]
    if (url === PARA_COBRAR) {
      if (viejo) throw VIEJO
      return [liviana('caja', 'Caja de Emanuel'), liviana('gal', 'Banco Galicia')]
    }
    if (url === '/api/v1/cuentas-corrientes/propias') return [cuenta('caja', 'Caja de Emanuel', 412300), cuenta('gal', 'Banco Galicia', 2184950.4)]
    const restante = url.match(/^\/api\/v1\/cuentas-corrientes\/propias\/([^/]+)\/saldo-restante\?monto=(.+)$/)
    if (restante) {
      if (viejo) throw VIEJO
      const monto = Number(restante[2])
      return { cuentaId: restante[1], moneda: 'ARS', saldoActual: 412300, monto, saldoRestante: 412300 - monto }
    }
    throw new Error(`sin respuesta para ${url}`)
  })
}

describe('cuentas y saldo que queda', () => {
  it('las cuentas salen de la lista liviana (para-cobrar), sin pedir los saldos de todas', async () => {
    servidorNuevo()
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    await screen.findAllByRole('radio', { name: /^Banco Galicia/ }, ESPERA)

    expect(get).toHaveBeenCalledWith(PARA_COBRAR, { estadosEsperados: [404] })
    expect(get.mock.calls.some(([u]) => u === '/api/v1/cuentas-corrientes/propias')).toBe(false)
  })

  it('con origen y monto, dice cuánto queda en la cuenta de origen según el servidor', async () => {
    servidorNuevo()
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await userEvent.press(radio('Desde', /^Caja de Emanuel/))
    fireEvent.changeText(screen.getByLabelText('Monto'), '350.000')

    expect(await screen.findByText('Te quedan $ 62.300,00 en Caja de Emanuel.', {}, ESPERA)).toBeTruthy()
    expect(get).toHaveBeenCalledWith('/api/v1/cuentas-corrientes/propias/caja/saldo-restante?monto=350000', { estadosEsperados: [404] })
  })

  it('lámina tesoreria-transferencia: lo que queda se dice en un aviso de éxito y en rojo (peligro) si no alcanza', async () => {
    servidorNuevo()
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await userEvent.press(radio('Desde', /^Caja de Emanuel/))
    fireEvent.changeText(screen.getByLabelText('Monto'), '350.000')
    const ok = await screen.findByText('Te quedan $ 62.300,00 en Caja de Emanuel.', {}, ESPERA)
    expect(ok.parent?.parent?.props.accessibilityRole).toBe('text')
    fireEvent.changeText(screen.getByLabelText('Monto'), '500.000')
    const rojo = await screen.findByText('Caja de Emanuel queda en -$ 87.700,00.', {}, ESPERA)
    expect(rojo.parent?.parent?.props.accessibilityRole).toBe('alert')
  })

  it('lámina tesoreria-transferencia: dice por qué solo hay cuentas propias y que el cobro de un cliente va con "Cobrar"', async () => {
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    expect(await screen.findByText('Solo se eligen cuentas propias: los clientes y la cartera de cheques no aparecen.', {}, ESPERA)).toBeTruthy()
    expect(screen.getByText('Si un cliente te transfirió, cargalo con "Cobrar" desde su ficha.')).toBeTruthy()
  })

  it('si el monto deja la cuenta en negativo, lo avisa', async () => {
    servidorNuevo()
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await userEvent.press(radio('Desde', /^Caja de Emanuel/))
    fireEvent.changeText(screen.getByLabelText('Monto'), '500.000')

    expect(await screen.findByText('Caja de Emanuel queda en -$ 87.700,00.', {}, ESPERA)).toBeTruthy()
  })

  it('sin MOD_CC:Read no pide el saldo que queda (el servidor contestaría 403)', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    servidorNuevo()
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await userEvent.press(radio('Desde', /^Caja de Emanuel/))
    fireEvent.changeText(screen.getByLabelText('Monto'), '350.000')

    // Pasa la espera de 400 ms del monto y se da tiempo a que salga cualquier pedido.
    await new Promise(r => setTimeout(r, 800))
    expect(get.mock.calls.some(([u]) => String(u).includes('/saldo-restante'))).toBe(false)
    expect(screen.queryByText(/Te quedan/)).toBeNull()
  })

  it('con un servidor anterior usa las cuentas propias con su saldo y no muestra lo que queda', async () => {
    servidorNuevo({ viejo: true })
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await screen.findAllByRole('radio', { name: /^Caja de Emanuel, saldo \$ 412\.300,00/ }, ESPERA)
    await userEvent.press(radio('Desde', /^Caja de Emanuel, saldo/))
    fireEvent.changeText(screen.getByLabelText('Monto'), '350.000')

    await waitFor(() => expect(get.mock.calls.some(([u]) => String(u).includes('/saldo-restante'))).toBe(true), ESPERA)
    expect(screen.queryByText(/Te quedan/)).toBeNull()
    expect(screen.queryByText(/No se pudo/)).toBeNull()
  })
})

it('registra el movimiento entre dos cuentas propias con el tipo del catálogo', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Banco Galicia/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '350.000')

  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(post).toHaveBeenCalledWith('/api/v1/movimientos-internos', {
    tipoMovimientoInternoId: 't-tr', cuentaOrigenId: 'caja', cuentaDestinoId: 'gal', monto: 350000, observaciones: null, retiradoPorNombre: null,
  })
  expect(await screen.findByText('Movimiento registrado')).toBeTruthy()
})

it('la cuenta de origen no se ofrece como destino', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA)
  await userEvent.press(radio('Desde', /^Banco Galicia/))

  expect(within(screen.getByLabelText('Hacia')).queryByRole('radio', { name: /^Banco Galicia/ })).toBeNull()
})

it('sin destino la plata sale: pide quién se la lleva y no manda cuenta de destino', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Retiro' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Ninguna/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '1000')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))
  expect(screen.getByText('Decí quién se lleva la plata.')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()

  fireEvent.changeText(screen.getByLabelText('Quién se la lleva'), 'Emanuel')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(post.mock.calls[0][1]).toMatchObject({ cuentaDestinoId: null, retiradoPorNombre: 'Emanuel' })
})

it('si el servidor rechaza, se ve su motivo', async () => {
  post.mockRejectedValue(new Error('La moneda del movimiento (ARS) no coincide con la moneda de la cuenta de origen (USD).'))
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))
  await userEvent.press(radio('Hacia', /^Banco Galicia/))
  fireEvent.changeText(screen.getByLabelText('Monto'), '10')
  await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))

  expect(await screen.findByText(/no coincide con la moneda/)).toBeTruthy()
  expect(screen.queryByText('Movimiento registrado')).toBeNull()
})

/** Como la web (L13): sin permiso la transferencia se ve deshabilitada con el motivo y no navega. */
async function transferenciaDeshabilitada() {
  const boton = await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA)
  expect(boton.props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA)).toBeTruthy()
  await userEvent.press(boton)
  expect(mockPush).not.toHaveBeenCalled()
}

it('en Tesorería, la transferencia solo se habilita con permiso para crear pagos', async () => {
  conPermisos([{ module: 'MOD_PAGOS', canRead: true }])
  const { unmount } = renderConQuery(<TesoreriaScreen />)
  await transferenciaDeshabilitada()
  unmount()

  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }, { module: 'MOD_CC', canRead: true }])
  renderConQuery(<TesoreriaScreen />)
  await userEvent.press(await screen.findByRole('button', { name: 'Transferencia entre cuentas' }, ESPERA))
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/tesoreria/transferencia')
})

it('sin permiso para ver cuentas corrientes la transferencia queda deshabilitada: su pantalla lista las cuentas propias', async () => {
  conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
  renderConQuery(<TesoreriaScreen />)
  await transferenciaDeshabilitada()
})

it('sin permiso para leer pagos la transferencia queda deshabilitada: su pantalla pide los tipos de movimiento (MOD_PAGOS:Read)', async () => {
  conPermisos([{ module: 'MOD_PAGOS', canCreate: true }, { module: 'MOD_CC', canRead: true }])
  renderConQuery(<TesoreriaScreen />)
  await transferenciaDeshabilitada()
})

it('la cartera de cheques y la caja de efectivo no se ofrecen ni de origen ni de destino', async () => {
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/movimientos-internos/tipos') return [{ id: 't-tr', nombre: 'Transferencia', activo: true }]
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) {
      return [
        cuenta('gal', 'Banco Galicia', 100),
        { ...cuenta('cart', 'Cartera de cheques', 5), esCuentaCarteraCheques: true },
        { ...cuenta('cef', 'Caja efectivo', 7), esCuentaCajaEfectivo: true },
      ]
    }
    throw new Error(`sin respuesta para ${url}`)
  })
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findAllByRole('radio', { name: /^Banco Galicia/ }, ESPERA)

  for (const grupo of ['Desde', 'Hacia']) {
    expect(within(screen.getByLabelText(grupo)).queryByRole('radio', { name: /^Cartera de cheques/ })).toBeNull()
    expect(within(screen.getByLabelText(grupo)).queryByRole('radio', { name: /^Caja efectivo/ })).toBeNull()
  }
})

describe('M15 Transferencia: permiso y aclaración (web)', () => {
  it('sin MOD_PAGOS:Create el botón se ve deshabilitado con el motivo y no manda nada', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }, { module: 'MOD_CC', canRead: true }])
    renderConQuery(<Transferencia onListo={jest.fn()} />)

    const boton = await screen.findByRole('button', { name: 'Registrar movimiento' }, ESPERA)
    expect(boton.props.accessibilityState?.disabled).toBe(true)
    expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA)).toBeTruthy()
    await userEvent.press(boton)
    expect(post).not.toHaveBeenCalled()
  })

  it('con permiso no hay motivo, y se aclara que el cobro de un cliente va en Registrar cobro', async () => {
    renderConQuery(<Transferencia onListo={jest.fn()} />)

    expect(await screen.findByText(AVISO_COBRO_DE_CLIENTE, {}, ESPERA)).toBeTruthy()
    expect(screen.queryByText(MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA)).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar movimiento' }).props.accessibilityState?.disabled).toBe(false)
  })
})

describe('N.º de operación (opcional): viaja dentro de observaciones', () => {
  async function registrarCon(numero: string, nota: string) {
    renderConQuery(<Transferencia onListo={jest.fn()} />)
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await userEvent.press(radio('Desde', /^Caja de Emanuel/))
    await userEvent.press(radio('Hacia', /^Banco Galicia/))
    fireEvent.changeText(screen.getByLabelText('Monto'), '1000')
    if (numero) fireEvent.changeText(screen.getByLabelText('N.º de operación (opcional)'), numero)
    if (nota) fireEvent.changeText(screen.getByLabelText('Observaciones (opcional)'), nota)
    await userEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }))
    return post.mock.calls[0][1].observaciones
  }

  it('con número y nota manda "Op. <número> · <nota>"', async () => {
    expect(await registrarCon('12345', 'Pago a proveedor')).toBe('Op. 12345 · Pago a proveedor')
  })
  it('con solo el número manda "Op. <número>"', async () => {
    expect(await registrarCon(' 12345 ', '')).toBe('Op. 12345')
  })
  it('con solo la nota manda la nota', async () => {
    expect(await registrarCon('', 'Pago a proveedor')).toBe('Pago a proveedor')
  })
})

it('al elegir la cuenta, "Desde" se pliega a una sola fila con la elegida y se puede cambiar (lámina Transferencia)', async () => {
  renderConQuery(<Transferencia onListo={jest.fn()} />)
  await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA)
  await userEvent.press(radio('Desde', /^Caja de Emanuel/))

  const desde = within(screen.getByLabelText('Desde'))
  expect(desde.queryByRole('radio', { name: /^Banco Galicia/ })).toBeNull()
  expect(desde.getByText('Caja de Emanuel')).toBeTruthy()
  await userEvent.press(desde.getByRole('button', { name: /Cambiar Desde/ }))
  expect(within(screen.getByLabelText('Desde')).getByRole('radio', { name: /^Banco Galicia/ })).toBeTruthy()
})

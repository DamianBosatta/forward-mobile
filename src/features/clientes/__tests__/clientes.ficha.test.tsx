import React from 'react'
import { Linking } from 'react-native'
import { screen, userEvent } from '@testing-library/react-native'
import { FichaCliente, AVISO_CONDICION_PAGO } from '../components/FichaCliente'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))


const get = api.get as jest.Mock
const detalle = (extra = {}) => ({
  ...clienteDeLista(),
  condicionesDeCompraFaltantes: [],
  condicionPago: { tipo: 'DiasDesdeEntrega', dias: 15 },
  topeCredito: 300000,
  ...extra,
})

function servidor(cliente: object, credito: object = {}) {
  get.mockImplementation(async (url: string) => {
    if (url.includes('/estado-cuenta')) return { socioComercialId: 'c1', razonSocial: 'x', saldoActual: 186420, saldoTst: 0, saldoNormal: 186420, saldoAFavor: 0, movimientosPendientes: [], ...credito }
    if (url.startsWith('/api/v1/Ventas')) return pagina([], 0)
    return cliente
  })
}

const abrir = async (solapa: string) => userEvent.press(await screen.findByRole('radio', { name: solapa }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true, canUpdate: true }])
  servidor(detalle())
})

it('la dirección es el título y el nombre va aparte', async () => {
  renderConQuery(<FichaCliente id="c1" />)

  expect(await screen.findByRole('header', { name: 'Av. del Valle 89' })).toBeTruthy()
  expect(screen.getByText('Chela · Kiosco Chela')).toBeTruthy()
})

it('en teléfono la ficha pone su barra: dirección de título, nombre aparte y el lápiz de Editar', async () => {
  renderConQuery(<FichaCliente id="c1" conBarra />)

  expect(await screen.findByText('Av. del Valle 89')).toBeTruthy()
  expect(screen.getByText('Chela · Kiosco Chela')).toBeTruthy()
  await userEvent.press(screen.getByRole('button', { name: 'Editar' }))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/socios/nuevo', params: { id: 'c1' } })
})

it('Llamar marca el teléfono y Cómo llegar abre el mapa con la dirección', async () => {
  renderConQuery(<FichaCliente id="c1" />)

  await userEvent.press(await screen.findByRole('button', { name: 'Llamar' }))
  expect(Linking.openURL).toHaveBeenCalledWith('tel:1146582291')
  await userEvent.press(screen.getByRole('button', { name: 'Cómo llegar' }))
  expect(Linking.openURL).toHaveBeenLastCalledWith(expect.stringContaining('query=Av.%20del%20Valle%2089'))
})

it('la cuenta corriente sale del endpoint vigente de estado de cuenta', async () => {
  renderConQuery(<FichaCliente id="c1" />)
  await abrir('Cuenta')

  expect(await screen.findByLabelText('Saldo: $ 186.420,00')).toBeTruthy()
  expect(get).toHaveBeenCalledWith('/api/v1/cuentas-corrientes/socios/c1/estado-cuenta')
})

it('si el servidor no deja ver la cuenta, ni se pide ni se muestra', async () => {
  servidor(detalle({ puedeVerCuentaCorriente: false }))
  renderConQuery(<FichaCliente id="c1" />)

  await screen.findByText('Datos')
  expect(screen.queryByText('Cuenta corriente')).toBeNull()
  expect(get.mock.calls.some(([u]) => String(u).includes('estado-cuenta'))).toBe(false)
})

it('sin la capacidad de autorizar ventas, la condición de pago se ve con candado y el aviso', async () => {
  renderConQuery(<FichaCliente id="c1" />)
  await abrir('Datos')

  expect(await screen.findByText('Cuenta corriente, 15 días desde la entrega')).toBeTruthy()
  expect(screen.getByText(AVISO_CONDICION_PAGO)).toBeTruthy()
})

it('con la capacidad de autorizar ventas no hay aviso de candado', async () => {
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true }, { module: 'CAP_AUTORIZAR_VENTA', canRead: true }])
  renderConQuery(<FichaCliente id="c1" />)
  await abrir('Datos')

  await screen.findByText('Cuenta corriente, 15 días desde la entrega')
  expect(screen.queryByText(AVISO_CONDICION_PAGO)).toBeNull()
})

it('Editar solo aparece si el servidor dice que este usuario puede editarlo', async () => {
  servidor(detalle({ puedeEditar: false }))
  renderConQuery(<FichaCliente id="c1" />)

  await screen.findByText('Datos')
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
})

it('si el servidor rechaza, se ve su mensaje', async () => {
  get.mockRejectedValue(new Error('No tenés permisos para esta acción.'))
  renderConQuery(<FichaCliente id="c1" />)

  expect(await screen.findByText('No tenés permisos para esta acción.')).toBeTruthy()
})

describe('vendedor responsable (servidor con PR #896)', () => {
  it('muestra "Vendedor" con el nombre en Datos cuando el servidor lo manda', async () => {
    servidor(detalle({ vendedorResponsableId: 'u1', vendedorResponsableNombre: 'Ana Pérez' }))
    renderConQuery(<FichaCliente id="c1" />)
    await abrir('Datos')

    expect(await screen.findByText('Ana Pérez')).toBeTruthy()
    expect(screen.getByText('Vendedor')).toBeTruthy()
  })

  it.each([
    ['sin vendedor (null)', { vendedorResponsableId: null, vendedorResponsableNombre: null }],
    ['con el nombre vacío', { vendedorResponsableId: 'u1', vendedorResponsableNombre: '  ' }],
    ['con un servidor anterior, que no manda el campo', {}],
  ])('no muestra "Vendedor" %s', async (_caso, extra) => {
    servidor(detalle(extra))
    renderConQuery(<FichaCliente id="c1" />)
    await abrir('Datos')

    await screen.findByText('Datos')
    expect(screen.getByText('Razón social')).toBeTruthy()
    expect(screen.queryByText('Vendedor')).toBeNull()
  })
})

describe('vencido y disponible (servidor con PR #882)', () => {
  const vencidaTst = { tieneDeudaVencida: true, deudaVencida: 86400, deudaVencidaTst: 86400, deudaVencidaNormal: 0 }

  it('muestra lo vencido con la cuenta, el disponible y el aviso de autorización', async () => {
    servidor(detalle(), { ...vencidaTst, creditoDisponible: 113580 })
    renderConQuery(<FichaCliente id="c1" />)
    await abrir('Cuenta')

    expect(await screen.findByLabelText('Vencido (más de 30 días): $ 86.400,00 · TST')).toBeTruthy()
    expect(screen.getByLabelText('Disponible: $ 113.580,00')).toBeTruthy()
    expect(screen.getByText('Tiene deuda vencida de más de 30 días: los pedidos nuevos van a quedar por autorizar.')).toBeTruthy()
  })

  it('con el tope pasado, el disponible negativo se dice como "Pasado del tope por"', async () => {
    servidor(detalle(), { tieneDeudaVencida: false, deudaVencida: 0, creditoDisponible: -12000 })
    renderConQuery(<FichaCliente id="c1" />)
    await abrir('Cuenta')

    expect(await screen.findByText('Pasado del tope por $ 12.000,00')).toBeTruthy()
    expect(screen.queryByText(/Vencido/)).toBeNull()
  })

  it('sin tope (null) o con un servidor anterior, no hay vencido ni disponible', async () => {
    servidor(detalle(), { tieneDeudaVencida: false, deudaVencida: 0, creditoDisponible: null })
    const { unmount } = renderConQuery(<FichaCliente id="c1" />)
    await abrir('Cuenta')
    await screen.findByLabelText('Saldo: $ 186.420,00')
    expect(screen.queryByText(/Disponible|Pasado del tope|Vencido/)).toBeNull()
    unmount()

    servidor(detalle())
    renderConQuery(<FichaCliente id="c1" />)
    await abrir('Cuenta')
    await screen.findByLabelText('Saldo: $ 186.420,00')
    expect(screen.queryByText(/Disponible|Pasado del tope|Vencido|deuda vencida/)).toBeNull()
  })
})

describe('láminas Ficha del cliente y TabClientes (bloque 12, T7)', () => {
  it('abre en Compras; Cuenta y Datos son solapas', async () => {
    renderConQuery(<FichaCliente id="c1" />)

    expect(await screen.findByText('Todavía no tiene ventas.')).toBeTruthy()
    expect(screen.queryByText('Razón social')).toBeNull()
    await abrir('Datos')
    expect(screen.getByText('Razón social')).toBeTruthy()
    expect(screen.queryByText('Todavía no tiene ventas.')).toBeNull()
  })

  it('sin permiso para ver la cuenta no hay solapa Cuenta ni cifras', async () => {
    servidor(detalle({ puedeVerCuentaCorriente: false }))
    renderConQuery(<FichaCliente id="c1" />)

    await screen.findByRole('radio', { name: 'Datos' })
    expect(screen.queryByRole('radio', { name: 'Cuenta' })) .toBeNull()
    expect(screen.queryByText('Crédito libre')).toBeNull()
  })

  it('el resumen muestra saldo, vencido y crédito libre tal como los manda el servidor', async () => {
    servidor(detalle(), { tieneDeudaVencida: true, deudaVencida: 84300, creditoDisponible: 73100 })
    renderConQuery(<FichaCliente id="c1" />)

    expect(await screen.findByText('Crédito libre')).toBeTruthy()
    expect(screen.getByText('$ 73.100,00')).toBeTruthy()
    expect(screen.getByText('Vencido $ 84.300,00')).toBeTruthy()
    // El saldo grande y la columna Normal (con factura) valen lo mismo en este caso.
    expect(screen.getAllByText('$ 186.420,00')).toHaveLength(2)
    expect(screen.getByText('Cuenta TST')).toBeTruthy()
  })

  it('pasado del tope: la cifra lo dice en vez de "Crédito libre"', async () => {
    servidor(detalle(), { creditoDisponible: -12000 })
    renderConQuery(<FichaCliente id="c1" />)

    expect(await screen.findByText('Pasado del tope')).toBeTruthy()
    expect(screen.queryByText('Crédito libre')).toBeNull()
  })

  it('WhatsApp abre el chat con el prefijo del país', async () => {
    renderConQuery(<FichaCliente id="c1" />)

    await userEvent.press(await screen.findByRole('button', { name: 'WhatsApp' }))
    expect(Linking.openURL).toHaveBeenCalledWith('https://wa.me/541146582291')
  })

  it('sin teléfono no hay Llamar ni WhatsApp', async () => {
    servidor(detalle({ telefono: '' }))
    renderConQuery(<FichaCliente id="c1" />)

    await screen.findByRole('radio', { name: 'Datos' })
    expect(screen.queryByRole('button', { name: 'Llamar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'WhatsApp' })).toBeNull()
  })

  it('Cobrar lleva a la pantalla de cobro con el cliente, solo con permiso de pagos y cuenta visible', async () => {
    conPermisos([{ module: 'MOD_CLIENTES', canRead: true }, { module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    renderConQuery(<FichaCliente id="c1" />)

    await userEvent.press(await screen.findByRole('button', { name: 'Cobrar' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: 'c1' } })
  })

  it('sin permiso de pagos Cobrar se ve deshabilitado y dice por qué', async () => {
    renderConQuery(<FichaCliente id="c1" />)

    const cobrar = await screen.findByRole('button', { name: 'Cobrar' })
    expect(cobrar.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))
    expect(screen.getByText('No tenés permiso para cobrar')).toBeTruthy()
    await userEvent.press(cobrar)
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('Vender desde la ficha (T4c)', () => {
  it('con permiso para crear ventas, Nueva venta abre la venta nueva con este cliente', async () => {
    conPermisos([{ module: 'MOD_CLIENTES', canRead: true }, { module: 'MOD_VENTAS', canRead: true, canCreate: true }])
    renderConQuery(<FichaCliente id="c1" />)

    await userEvent.press(await screen.findByRole('button', { name: 'Nueva venta' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/ventas/nueva?clienteId=c1')
  })

  it('sin permiso para crear ventas no hay Nueva venta', async () => {
    renderConQuery(<FichaCliente id="c1" />)

    await screen.findByRole('button', { name: 'Llamar' })
    expect(screen.queryByRole('button', { name: 'Nueva venta' })).toBeNull()
  })
})

import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { PagarServicio } from '../components/PagarServicio'
import { cuerpoDelGasto, validarServicio, type FormServicio } from '../lib/servicio'
import { MOTIVO_SIN_PERMISO_DE_SERVICIO } from '@/core/ui/fw/MotivoDeshabilitado'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'

const mockShow = jest.fn()
jest.mock('@/core/ui/Toast', () => ({ useToast: () => ({ show: mockShow }) }))
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const post = api.post as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

const PERMISOS = [
  { module: 'MOD_PAGOS', canRead: true, canCreate: true },
  { module: 'MOD_CC', canRead: true },
  { module: 'CAP_VER_TESORERIA', canRead: true },
]
const liviana = (id: string, nombre: string) => ({ id, nombre, moneda: 'ARS', esPrincipal: false, esCuentaCajaEfectivo: false, esCuentaCarteraCheques: false })

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos(PERMISOS)
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/gastos/tipos-gasto') return [{ id: 'tg-luz', nombre: 'Luz', activo: true }, { id: 'tg-gas', nombre: 'Gas', activo: true }]
    if (url === '/api/v1/gastos/medios-pago') return [
      { id: 'm-ef', nombre: 'Efectivo', requiereCaja: true, esCheque: false, activo: true },
      { id: 'm-tr', nombre: 'Transferencia', requiereCaja: false, esCheque: false, activo: true },
      { id: 'm-ch', nombre: 'Cheque', requiereCaja: false, esCheque: true, activo: true },
    ]
    if (url.startsWith('/api/v1/cuentas-corrientes/propias')) return [liviana('gal', 'Banco Galicia')]
    throw new Error(`sin respuesta para ${url}`)
  })
  post.mockResolvedValue({ succeeded: true, data: 'g1' })
})

const vacio: FormServicio = { monto: '', tipoGastoId: null, descripcion: '', medioPagoId: null, requiereCaja: false, cuentaOrigenId: null, comprobanteUrl: null }
const completo: FormServicio = { ...vacio, monto: '1.500,50', tipoGastoId: 'tg-luz', medioPagoId: 'm-tr', cuentaOrigenId: 'gal' }

describe('validación', () => {
  it('el monto tiene que ser mayor a cero', () => {
    expect(validarServicio({ ...completo, monto: '' })).toBe('Ingresá el monto.')
    expect(validarServicio({ ...completo, monto: '0' })).toBe('Ingresá el monto.')
  })
  it('el concepto es obligatorio', () => {
    expect(validarServicio({ ...completo, tipoGastoId: null })).toBe('Elegí el concepto.')
  })
  it('un medio sin caja pide la cuenta de origen; en efectivo no', () => {
    expect(validarServicio({ ...completo, cuentaOrigenId: null })).toBe('Elegí la cuenta de origen.')
    expect(validarServicio({ ...completo, medioPagoId: 'm-ef', requiereCaja: true, cuentaOrigenId: null })).toBeNull()
  })
  it('un formulario completo es válido', () => {
    expect(validarServicio(completo)).toBeNull()
    expect(validarServicio(vacio)).not.toBeNull()
  })
})

describe('cuerpo del gasto', () => {
  it('manda monto, concepto, medio, cuenta y comprobante; sin descripción usa el nombre del concepto', () => {
    expect(cuerpoDelGasto({ ...completo, comprobanteUrl: 'https://s/f.jpg' }, 'Luz')).toEqual({
      descripcion: 'Luz', monto: 1500.5, tipoGastoId: 'tg-luz', medioPagoId: 'm-tr', cuentaOrigenId: 'gal', comprobanteUrl: 'https://s/f.jpg',
    })
  })
  it('con descripción la manda recortada; en efectivo no manda cuenta', () => {
    expect(cuerpoDelGasto({ ...completo, descripcion: '  Factura mayo ', medioPagoId: 'm-ef', requiereCaja: true }, 'Luz')).toMatchObject({
      descripcion: 'Factura mayo', cuentaOrigenId: null, comprobanteUrl: null,
    })
  })
})

describe('pantalla', () => {
  it('registra el pago: POST /gastos con el cuerpo, avisa con un toast y vuelve', async () => {
    const onListo = jest.fn()
    renderConQuery(<PagarServicio onListo={onListo} />)
    fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), '1.500,50')
    await userEvent.press(await screen.findByRole('radio', { name: 'Luz' }, ESPERA))
    await userEvent.press(await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA))
    await userEvent.press(await screen.findByRole('radio', { name: /^Banco Galicia/ }, ESPERA))
    await userEvent.press(screen.getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/gastos', {
      descripcion: 'Luz', monto: 1500.5, tipoGastoId: 'tg-luz', medioPagoId: 'm-tr', cuentaOrigenId: 'gal', comprobanteUrl: null,
    }), ESPERA)
    await waitFor(() => expect(onListo).toHaveBeenCalled(), ESPERA)
    expect(mockShow).toHaveBeenCalledWith('Pago registrado', 'success')
  })

  it('sin concepto no llama al servidor y dice qué falta', async () => {
    renderConQuery(<PagarServicio onListo={jest.fn()} />)
    fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), '100')
    await userEvent.press(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText('Elegí el concepto.')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('no ofrece el cheque como medio de pago (queda para su propio endpoint)', async () => {
    renderConQuery(<PagarServicio onListo={jest.fn()} />)
    await screen.findByRole('radio', { name: 'Transferencia' }, ESPERA)
    expect(screen.queryByRole('radio', { name: 'Cheque' })).toBeNull()
  })

  it('sin el permiso del servidor (MOD_PAGOS crear) el botón queda deshabilitado con el motivo', async () => {
    conPermisos([{ module: 'MOD_PAGOS', canRead: true }, { module: 'CAP_VER_TESORERIA', canRead: true }])
    renderConQuery(<PagarServicio onListo={jest.fn()} />)
    const boton = await screen.findByRole('button', { name: 'Registrar pago' }, ESPERA)
    expect(boton.props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText(MOTIVO_SIN_PERMISO_DE_SERVICIO)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })
})

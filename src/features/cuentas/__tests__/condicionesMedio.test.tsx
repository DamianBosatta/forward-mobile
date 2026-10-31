import React from 'react'
import { fireEvent, screen, userEvent } from '@testing-library/react-native'
import { RegistrarCobro } from '../components/RegistrarCobro'
import { condicionesDelMedio } from '../lib/condicionesMedio'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '@/features/clientes/__testing__/ayuda'
import { estadoDeCuenta, fichaConCuentas } from '../__testing__/servidor'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), postConSobre: jest.fn() },
  API_URL: '',
}))

const get = api.get as jest.Mock
const ESPERA = { timeout: 5000 }
jest.setTimeout(15_000)

const MEDIOS = [
  { id: 'm-ef', nombre: 'Efectivo', requiereCaja: false, esCheque: false, activo: true, comisionPorcentaje: 0, diasAcreditacion: 0 },
  { id: 'm-tj', nombre: 'Tarjeta', requiereCaja: false, esCheque: false, activo: true, comisionPorcentaje: 2.5, diasAcreditacion: 2 },
]

describe('condicionesDelMedio', () => {
  it('calcula comisión y neto sobre el monto y trae los días de acreditación', () => {
    expect(condicionesDelMedio({ comisionPorcentaje: 2.5, diasAcreditacion: 2 }, 1000)).toEqual({ comisionPorcentaje: 2.5, comision: 25, neto: 975, diasAcreditacion: 2 })
  })
  it('sin monto no calcula; sin comisión ni demora devuelve null', () => {
    expect(condicionesDelMedio({ comisionPorcentaje: 2.5, diasAcreditacion: 0 }, null)).toMatchObject({ comision: null, neto: null })
    expect(condicionesDelMedio({ comisionPorcentaje: 0, diasAcreditacion: 0 }, 1000)).toBeNull()
    expect(condicionesDelMedio(undefined, 1000)).toBeNull()
  })
})

describe('RegistrarCobro: condiciones del medio (solo informativo)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    conPermisos([{ module: 'MOD_PAGOS', canRead: true, canCreate: true }])
    get.mockImplementation(async (url: string) => {
      if (url === '/api/v1/gastos/medios-pago') return MEDIOS
      if (url === '/api/v1/Cajas/abiertas/estado') return []
      if (url.endsWith('/estado-cuenta')) return estadoDeCuenta()
      return fichaConCuentas()
    })
  })

  it('con un medio que cobra comisión muestra comisión, neto y acreditación', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), '1.000')
    await userEvent.press(await screen.findByRole('radio', { name: 'Tarjeta' }, ESPERA))

    const caja = await screen.findByLabelText(/Condiciones del medio/, {}, ESPERA)
    expect(caja.props.accessibilityLabel).toContain('Comisión 2,5 %')
    expect(screen.getByText('Neto $\u00A0975,00')).toBeTruthy()
    expect(screen.getByText('Se acredita en 2 días')).toBeTruthy()
  })

  it('con un medio sin comisión ni demora no muestra nada', async () => {
    renderConQuery(<RegistrarCobro socioId="c1" onVolver={jest.fn()} />)
    fireEvent.changeText(await screen.findByLabelText('Monto', {}, ESPERA), '1.000')
    await userEvent.press(await screen.findByRole('radio', { name: 'Efectivo' }, ESPERA))

    expect(screen.queryByLabelText(/Condiciones del medio/)).toBeNull()
  })
})

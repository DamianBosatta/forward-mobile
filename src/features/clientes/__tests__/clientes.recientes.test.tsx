import React from 'react'
import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { SeleccionarClienteSheet } from '../components/SeleccionarClienteSheet'
import { fusionarRecientes, guardarReciente, leerRecientes, MAX_RECIENTES, type ClienteElegido } from '../lib/recientes'
import { storage } from '@/core/utils/storage'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isLarge: false }) }))

const get = api.get as jest.Mock
const RECIENTES_URL = '/api/v1/socios-comerciales/clientes-recientes?limite=5'
const onSelect = jest.fn()
const hoja = () => <SeleccionarClienteSheet visible onClose={jest.fn()} onSelect={onSelect} onNuevoCliente={jest.fn()} />

const delServidor = (id: string, direccion: string, extra: object = {}) => ({
  id, razonSocial: `Razón ${id}`, direccion, nombreFantasia: null, nombreContacto: null,
  displayName: direccion, ultimoUso: '2026-10-12T15:00:00Z', ...extra,
})

/** Servidor falso: la cartera vacía, `recientes` para clientes-recientes y `detalle` para la ficha de un cliente. */
function servidor(recientes: () => Promise<unknown>, detalle: () => Promise<unknown> = () => Promise.resolve(clienteDeLista())) {
  get.mockImplementation((url: string) => {
    const u = String(url)
    if (u.startsWith('/api/v1/socios-comerciales?')) return Promise.resolve(pagina([], 0))
    if (u.startsWith('/api/v1/socios-comerciales/clientes-recientes')) return recientes()
    return detalle()
  })
}

const conStatus = (status: number) => () => Promise.reject(Object.assign(new Error(String(status)), { status }))

beforeEach(() => {
  jest.clearAllMocks()
  storage.clearAll()
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true }])
})

describe('fusionarRecientes', () => {
  const c = (id: string, direccion = `Calle ${id}`): ClienteElegido => ({ id, direccion })

  it('el servidor va primero, sin repetir, y gana en los datos', () => {
    const r = fusionarRecientes([c('a', 'Nueva A'), c('b')], [c('b', 'Vieja B'), c('c')])

    expect(r.map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(r[1].direccion).toBe('Calle b')
  })

  it('deja hasta MAX_RECIENTES', () => {
    const r = fusionarRecientes([c('1'), c('2'), c('3')], [c('4'), c('5'), c('6'), c('7')])

    expect(r).toHaveLength(MAX_RECIENTES)
    expect(r.map(x => x.id)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('sin respuesta del servidor quedan los del teléfono, en su orden', () => {
    expect(fusionarRecientes(undefined, [c('x'), c('y')]).map(x => x.id)).toEqual(['x', 'y'])
  })

  it('una respuesta que no es una lista se ignora', () => {
    expect(fusionarRecientes({ items: [] } as never, [c('x')]).map(x => x.id)).toEqual(['x'])
  })

  it('no muestra los descartados, vengan de donde vengan', () => {
    const r = fusionarRecientes([c('a'), c('b')], [c('a'), c('d')], ['a'])

    expect(r.map(x => x.id)).toEqual(['b', 'd'])
  })

  it('se queda solo con lo mínimo para nombrar al cliente', () => {
    const r = fusionarRecientes([{ ...c('z'), cuit: '20-1', saldoAmount: 5 } as never], [])

    expect(JSON.stringify(r)).not.toContain('20-1')
    expect(JSON.stringify(r)).not.toContain('saldoAmount')
  })
})

describe('recientes del servidor en el selector', () => {
  it('un teléfono nuevo muestra los recientes del servidor', async () => {
    servidor(() => Promise.resolve([delServidor('s1', 'Brandsen 3314'), delServidor('s2', 'Gral. Paz 10450')]))
    renderConQuery(hoja())

    expect(await screen.findByText('Brandsen 3314')).toBeTruthy()
    expect(screen.getByText('Gral. Paz 10450')).toBeTruthy()
    expect(screen.getByText('Recientes')).toBeTruthy()
    expect(get).toHaveBeenCalledWith(RECIENTES_URL, { estadosEsperados: [404] })
  })

  it('mezcla: primero los del servidor, después los del teléfono, sin repetir', async () => {
    guardarReciente('u1', { id: 's1', direccion: 'Dirección vieja' })
    guardarReciente('u1', { id: 'l1', direccion: 'Solo en el teléfono' })
    servidor(() => Promise.resolve([delServidor('s1', 'Brandsen 3314')]))
    renderConQuery(hoja())

    await screen.findByText('Brandsen 3314')

    const filas = screen.getAllByRole('button').map(b => b.props.accessibilityLabel).filter(Boolean)
    expect(filas.slice(0, 2)).toEqual(['Brandsen 3314, Razón s1', 'Solo en el teléfono'])
    expect(screen.queryByText('Dirección vieja')).toBeNull()
  })

  it('muestra como mucho cinco', async () => {
    for (const n of [1, 2, 3, 4]) guardarReciente('u1', { id: `l${n}`, direccion: `Local ${n}` })
    servidor(() => Promise.resolve([1, 2, 3].map(n => delServidor(`s${n}`, `Servidor ${n}`))))
    renderConQuery(hoja())

    await screen.findByText('Servidor 1')

    expect(screen.getAllByText(/^(Servidor|Local) \d$/)).toHaveLength(MAX_RECIENTES)
    expect(screen.getByText('Local 4')).toBeTruthy()
    expect(screen.queryByText('Local 2')).toBeNull()
  })

  it('un reciente del servidor que ya no está disponible se avisa y no vuelve a salir', async () => {
    servidor(() => Promise.resolve([delServidor('s1', 'Brandsen 3314')]), conStatus(404))
    renderConQuery(hoja())

    await userEvent.press(await screen.findByRole('button', { name: /Brandsen 3314/ }))

    expect(await screen.findByText('Ese cliente ya no está disponible en tu cartera.')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.queryByText('Brandsen 3314')).toBeNull()
  })

  it('elegir uno del servidor lo suma a los del teléfono', async () => {
    servidor(() => Promise.resolve([delServidor('c1', 'Brandsen 3314')]))
    renderConQuery(hoja())

    await userEvent.press(await screen.findByRole('button', { name: /Brandsen 3314/ }))

    await waitFor(() => expect(onSelect).toHaveBeenCalled())
    expect(leerRecientes('u1').map(x => x.id)).toEqual(['c1'])
  })
})

describe('servidor sin el endpoint o con falla: queda lo del teléfono', () => {
  const locales = () => {
    guardarReciente('u1', { id: 'l1', direccion: 'Calle Vieja 1', nombreFantasia: 'Local viejo' })
    guardarReciente('u1', { id: 'l2', direccion: 'Calle Vieja 2' })
  }

  it.each([
    ['un 404', conStatus(404)],
    ['un 403', conStatus(403)],
    ['un 500', conStatus(500)],
    ['una falla de red', () => Promise.reject(new Error('Network request failed'))],
    ['una respuesta que no es una lista', () => Promise.resolve({ foo: 1 })],
  ])('%s', async (_nombre, recientes) => {
    locales()
    servidor(recientes)
    renderConQuery(hoja())

    expect(await screen.findByText('Calle Vieja 2')).toBeTruthy()
    expect(screen.getByText('Calle Vieja 1')).toBeTruthy()
    expect(screen.getByText('Recientes')).toBeTruthy()
    await waitFor(() => expect(get).toHaveBeenCalledWith(RECIENTES_URL, expect.anything()))
    expect(screen.queryByText(/no se pudo/i)).toBeNull()
    expect(leerRecientes('u1').map(x => x.id)).toEqual(['l2', 'l1'])
  })

  it('sin recientes en ningún lado no hay sección', async () => {
    servidor(conStatus(404))
    renderConQuery(hoja())

    await waitFor(() => expect(get).toHaveBeenCalledWith(RECIENTES_URL, expect.anything()))
    expect(screen.queryByText('Recientes')).toBeNull()
  })
})

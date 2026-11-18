import React from 'react'
import { Alert } from 'react-native'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { cambiarEstado, encolarAccion, leerCola, quitarDeCola, type DatosAccion } from '../cola/colaConsola'
import { ColaConsola } from '../cola/PildoraColaConsola'
import { useColaConsola } from '../cola/useColaConsola'

/**
 * RED-01 / RED-R3-02: una acción de la consola que quedó para revisar (el servidor la rechazó o se detuvo por el tope)
 * se reintenta o se descarta desde la lista de la píldora. Descartar solo la saca del teléfono, con confirmación.
 */

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { post: (url: string, body?: unknown) => mockPost(url, body) },
}))

const USUARIO = 'u1'
const entrega: DatosAccion = {
  tipo: 'entrega', clave: 'k-1', hojaDeRutaId: 'h1', paradaId: 'p1', clienteNombre: 'Almacén Don Pepe',
  cuerpo: { claveIdempotencia: 'k-1', nombreReceptor: 'Marta' }, cobrado: 160000, conDevolucion: false,
} as DatosAccion
const noEntrega: DatosAccion = {
  tipo: 'noEntrega', clave: 'k-2', hojaDeRutaId: 'h1', paradaId: 'p2', clienteNombre: 'Kiosco Los Pibes',
  cuerpo: { entregado: false, motivoRechazo: 'Cerrado' },
} as DatosAccion

/** Como en la consola: la lista lee la cola del usuario logueado. */
function Pantalla() {
  const { items } = useColaConsola()
  return <ColaConsola acciones={items} />
}

async function abrirLista() {
  render(<Pantalla />)
  await userEvent.press(screen.getByLabelText('Ver las acciones esperando señal'))
  return screen.getByLabelText('Acciones esperando señal')
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: USUARIO } } as never)
  mockPost.mockReset()
  jest.restoreAllMocks()
  for (const a of leerCola(USUARIO)) quitarDeCola(USUARIO, a.clave)
  encolarAccion(USUARIO, entrega, 1000)
  encolarAccion(USUARIO, noEntrega, 2000)
  cambiarEstado(USUARIO, 'k-1', { tipo: 'revisar', mensaje: 'La conexión tardó demasiado.' })
})

describe('acciones para revisar en la cola de la consola', () => {
  it('cada acción para revisar muestra su motivo con Reintentar y Descartar; la que espera señal no tiene botones', async () => {
    const hoja = await abrirLista()
    expect(within(hoja).getByText('Para revisar: La conexión tardó demasiado.')).toBeTruthy()
    expect(within(hoja).getAllByRole('button', { name: /^Reintentar/ })).toHaveLength(1)
    expect(within(hoja).getAllByRole('button', { name: /^Descartar/ })).toHaveLength(1)
    expect(within(hoja).getByRole('button', { name: 'Reintentar entrega y cobro de Almacén Don Pepe' })).toBeTruthy()
  })

  it('el texto de la lista dice que hay acciones para revisar; sin ninguna, que se mandan solas', async () => {
    const hoja = await abrirLista()
    expect(within(hoja).getByText(
      'Las que esperan señal se mandan solas, en este orden, cuando vuelva la conexión. 1 acción para revisar: tocá Reintentar o Descartar.',
    )).toBeTruthy()
    await userEvent.press(within(hoja).getByRole('button', { name: 'Reintentar entrega y cobro de Almacén Don Pepe' }))
    expect(within(hoja).getByText('Se mandan solas, en este orden, cuando vuelva la conexión.')).toBeTruthy()
  })

  it('Reintentar la vuelve a la cola esperando señal, con la misma clave y el mismo cuerpo, y desaparecen sus botones', async () => {
    const hoja = await abrirLista()
    await userEvent.press(within(hoja).getByRole('button', { name: 'Reintentar entrega y cobro de Almacén Don Pepe' }))
    const [a] = leerCola(USUARIO)
    expect(a).toMatchObject({ clave: 'k-1', cuerpo: { claveIdempotencia: 'k-1', nombreReceptor: 'Marta' }, estado: { tipo: 'esperando', intentos: 0 } })
    expect(within(hoja).queryByRole('button', { name: /^Reintentar/ })).toBeNull()
    expect(within(hoja).queryByText(/^Para revisar/)).toBeNull()
  })

  it('Descartar pide confirmación; al confirmar la saca solo del teléfono, sin llamar al servidor', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => botones?.find((b) => b.text === 'Descartar')?.onPress?.())
    const hoja = await abrirLista()
    await userEvent.press(within(hoja).getByRole('button', { name: 'Descartar entrega y cobro de Almacén Don Pepe' }))
    expect(alerta).toHaveBeenCalledWith(
      '¿Descartar esta acción?',
      expect.stringContaining('Se borra solo de este teléfono'),
      expect.arrayContaining([expect.objectContaining({ text: 'Cancelar', style: 'cancel' }), expect.objectContaining({ text: 'Descartar', style: 'destructive' })]),
    )
    expect(leerCola(USUARIO).map((x) => x.clave)).toEqual(['k-2'])
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('Descartar y cancelar deja la acción como estaba', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => botones?.find((b) => b.text === 'Cancelar')?.onPress?.())
    const hoja = await abrirLista()
    await userEvent.press(within(hoja).getByRole('button', { name: 'Descartar entrega y cobro de Almacén Don Pepe' }))
    expect(leerCola(USUARIO).map((x) => [x.clave, x.estado.tipo])).toEqual([['k-1', 'revisar'], ['k-2', 'esperando']])
  })
})

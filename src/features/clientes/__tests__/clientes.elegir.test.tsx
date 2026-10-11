import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { SeleccionarClienteSheet } from '../components/SeleccionarClienteSheet'
import { guardarReciente, leerRecientes } from '../lib/recientes'
import { storage } from '@/core/utils/storage'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, pagina, renderConQuery } from '../__testing__/ayuda'

jest.mock('@/core/api/client', () => ({ api: { get: jest.fn() }, API_URL: '' }))
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => ({ width: 390, isLarge: false }) }))

const get = api.get as jest.Mock
const urlsDeLista = () => get.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/v1/socios-comerciales?'))
const onSelect = jest.fn()
const onNuevoCliente = jest.fn()
const hoja = () => <SeleccionarClienteSheet visible onClose={jest.fn()} onSelect={onSelect} onNuevoCliente={onNuevoCliente} />

beforeEach(() => {
  jest.clearAllMocks()
  storage.clearAll()
  conPermisos([{ module: 'MOD_CLIENTES', canRead: true }])
  get.mockResolvedValue(pagina([clienteDeLista()], 1))
})

it('devuelve el cliente elegido y el tipo de documento', async () => {
  renderConQuery(hoja())

  await userEvent.press(screen.getByRole('radio', { name: 'Presupuesto' }))
  await userEvent.press(await screen.findByRole('button', { name: 'Av. del Valle 89, Chela · Kiosco Chela' }))

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', direccion: 'Av. del Valle 89' }), 'Presupuesto')
})

it('cada cliente se nombra por su dirección, con el nombre en una línea aparte', async () => {
  renderConQuery(hoja())

  expect(await screen.findByText('Av. del Valle 89')).toBeTruthy()
  expect(screen.getByText('Chela · Kiosco Chela')).toBeTruthy()
  expect(screen.queryByText(/Av\. del Valle 89.*Kiosco/)).toBeNull()
})

it('busca en el servidor, sobre la cartera, después de dejar de tipear', async () => {
  renderConQuery(hoja())
  await screen.findByText('Av. del Valle 89')

  fireEvent.changeText(screen.getByLabelText('Buscar cliente'), 'Va')
  fireEvent.changeText(screen.getByLabelText('Buscar cliente'), 'Valle')
  expect(urlsDeLista().some(u => u.includes('searchTerm'))).toBe(false)

  await waitFor(() => expect(urlsDeLista().filter(u => u.includes('searchTerm'))).toEqual([expect.stringContaining('searchTerm=Valle')]))
  expect(urlsDeLista().every(u => u.includes('agenda=true'))).toBe(true)
})

it('el cliente elegido queda en Recientes, sin guardar datos sensibles en el teléfono', async () => {
  const { unmount } = renderConQuery(hoja())
  await userEvent.press(await screen.findByRole('button', { name: /Av\. del Valle 89/ }))
  unmount()

  get.mockResolvedValue(pagina([], 0))
  renderConQuery(hoja())

  expect(await screen.findByText('Recientes')).toBeTruthy()
  expect(screen.getByText('Av. del Valle 89')).toBeTruthy()
  const guardado = storage.getAllKeys().map(k => storage.getString(k)).join(' ')
  expect(guardado).not.toContain('27-24389156-3')
  expect(guardado).not.toContain('1146582291')
  expect(guardado).not.toContain('186420')
})

it('si el servidor rechaza, se ve su mensaje', async () => {
  get.mockRejectedValue(new Error('No tenés permisos para esta acción.'))
  renderConQuery(hoja())

  expect(await screen.findByText('No tenés permisos para esta acción.')).toBeTruthy()
})

it('Nuevo cliente avisa para abrir el alta', async () => {
  renderConQuery(hoja())
  await userEvent.press(screen.getByRole('button', { name: 'Nuevo cliente' }))

  expect(onNuevoCliente).toHaveBeenCalled()
})

describe('recientes', () => {
  const reciente = { id: 'c1', direccion: 'Calle Vieja 1', nombreFantasia: 'Local viejo' }
  const servidor = (detalle: () => Promise<unknown>) =>
    get.mockImplementation((u: string) => (String(u).startsWith('/api/v1/socios-comerciales?') ? Promise.resolve(pagina([], 0)) : detalle()))

  it('un reciente que el servidor rechaza no se elige, se avisa y se quita', async () => {
    guardarReciente('u1', reciente)
    servidor(() => Promise.reject(Object.assign(new Error('403'), { status: 403 })))
    renderConQuery(hoja())

    await userEvent.press(await screen.findByRole('button', { name: /Calle Vieja 1/ }))

    expect(await screen.findByText('Ese cliente ya no está disponible en tu cartera.')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
    expect(leerRecientes('u1')).toEqual([])
    expect(screen.queryByText('Calle Vieja 1')).toBeNull()
  })

  it('un reciente dado de baja tampoco se elige', async () => {
    guardarReciente('u1', reciente)
    servidor(() => Promise.resolve({ ...clienteDeLista(), activo: false }))
    renderConQuery(hoja())

    await userEvent.press(await screen.findByRole('button', { name: /Calle Vieja 1/ }))

    expect(await screen.findByText('Ese cliente ya no está disponible en tu cartera.')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('un reciente válido se elige con la dirección fresca del servidor', async () => {
    guardarReciente('u1', reciente)
    servidor(() => Promise.resolve(clienteDeLista({ direccion: 'Av. del Valle 89' })))
    renderConQuery(hoja())

    await userEvent.press(await screen.findByRole('button', { name: /Calle Vieja 1/ }))

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', direccion: 'Av. del Valle 89' }), 'Pedido'))
    expect(leerRecientes('u1')[0].direccion).toBe('Av. del Valle 89')
  })

  it('una falla de red no quita el reciente ni lo elige', async () => {
    guardarReciente('u1', reciente)
    servidor(() => Promise.reject(new Error('Network request failed')))
    renderConQuery(hoja())

    await userEvent.press(await screen.findByRole('button', { name: /Calle Vieja 1/ }))

    expect(await screen.findByText('No se pudo verificar el cliente. Probá de nuevo.')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
    expect(leerRecientes('u1')).toHaveLength(1)
    expect(screen.getByText('Calle Vieja 1')).toBeTruthy()
  })

  it('un 404 quita el reciente', async () => {
    guardarReciente('u1', reciente)
    servidor(() => Promise.reject(Object.assign(new Error('x'), { status: 404 })))
    renderConQuery(hoja())

    await userEvent.press(await screen.findByRole('button', { name: /Calle Vieja 1/ }))

    expect(await screen.findByText('Ese cliente ya no está disponible en tu cartera.')).toBeTruthy()
    expect(leerRecientes('u1')).toEqual([])
  })

  it('dos toques seguidos mientras se verifica eligen una sola vez', async () => {
    guardarReciente('u1', reciente)
    servidor(() => Promise.resolve(clienteDeLista()))
    renderConQuery(hoja())

    const fila = await screen.findByRole('button', { name: /Calle Vieja 1/ })
    fireEvent.press(fila)
    fireEvent.press(fila)

    await waitFor(() => expect(onSelect).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 20))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

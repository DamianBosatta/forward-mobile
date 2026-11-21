import React from 'react'
import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { api } from '@/core/api/client'
import { conPermisos, renderConQuery } from '../__testing__/ayuda'
import { GestionDelCliente } from '../components/GestionDelCliente'
import type { SocioDetailDto } from '@/libs/api-client/types'

jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))
const get = api.get as jest.Mock
const put = api.put as jest.Mock

const VENDEDORES = [{ id: 'v1', nombre: 'Lucía Paz' }]
const DEPOSITOS = [{ id: 'd1', nombre: 'Central', activo: true }]
const cliente = { id: 'c1', vendedorResponsableId: null, depositoIds: ['d1'] } as unknown as SocioDetailDto

function servidor({ vendedores = VENDEDORES as unknown, depositos = DEPOSITOS as unknown } = {}) {
  get.mockImplementation(async (url: string) => {
    const r = url === '/api/v1/Ventas/vendedores' ? vendedores : url === '/api/v1/Depositos' ? depositos : undefined
    if (r instanceof Error) throw r
    return r
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  conPermisos([
    { module: 'CAP_GESTIONAR_CARTERA_CLIENTES', canRead: true },
    { module: 'CAP_VER_TODOS_LOS_DEPOSITOS', canRead: true },
    { module: 'MOD_CLIENTES', canRead: true, canUpdate: true },
  ])
  servidor()
})

describe('gestión del cliente: vendedores y depósitos que no cargan (RED-11)', () => {
  it('si falla la lista de vendedores lo dice y Reintentar la vuelve a pedir', async () => {
    servidor({ vendedores: new Error('falló') })
    renderConQuery(<GestionDelCliente cliente={cliente} />)
    expect(await screen.findByText('No se pudieron cargar los vendedores. Tocá Reintentar.')).toBeTruthy()

    servidor()
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar vendedores' }))
    expect(await screen.findByRole('radio', { name: 'Lucía Paz' })).toBeTruthy()
    expect(screen.queryByText('No se pudieron cargar los vendedores. Tocá Reintentar.')).toBeNull()
  })

  it('si falla la lista de depósitos lo dice, ofrece Reintentar y "Guardar depósitos" queda apagado', async () => {
    servidor({ depositos: new Error('falló') })
    renderConQuery(<GestionDelCliente cliente={cliente} />)
    expect(await screen.findByText('No se pudieron cargar los depósitos. Tocá Reintentar.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar depósitos' })).toBeDisabled()

    servidor()
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar depósitos' }))
    expect(await screen.findByRole('checkbox', { name: 'Central' })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar depósitos' })).toBeEnabled())
  })

  it('con las listas cargadas, guardar depósitos manda los elegidos como siempre', async () => {
    put.mockResolvedValue(true)
    renderConQuery(<GestionDelCliente cliente={cliente} />)
    await screen.findByRole('checkbox', { name: 'Central' })
    await userEvent.press(screen.getByRole('button', { name: 'Guardar depósitos' }))
    expect(await screen.findByText('Depósitos guardados.')).toBeTruthy()
    expect(put).toHaveBeenCalledWith('/api/v1/socios-comerciales/c1/depositos', { socioId: 'c1', depositoIds: ['d1'] })
  })
})

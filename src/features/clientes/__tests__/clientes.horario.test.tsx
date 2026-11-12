import React from 'react'
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import ClienteFormScreen from '../../../../app/(tabs)/socios/nuevo'
import { api } from '@/core/api/client'
import { clienteDeLista, conPermisos, renderConQuery } from '../__testing__/ayuda'
import { HORARIO_INVALIDO } from '../hooks/useClienteForm'
import { ERROR_SIN_DIAS } from '@/core/utils/horario'

let mockId: string | undefined
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
}))
jest.mock('expo-router/react-navigation', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}))
jest.mock('@/core/api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, API_URL: '' }))

const post = api.post as jest.Mock
const put = api.put as jest.Mock
const PERMISOS = [{ module: 'MOD_CLIENTES', canRead: true, canCreate: true, canUpdate: true }]
const f = (dia: number, desde: string, hasta: string) => ({ dia, desde, hasta })
const detalle = (horario: unknown[]) => ({ ...clienteDeLista(), horario, condicionesDeCompraFaltantes: [] })

beforeEach(() => {
  jest.clearAllMocks()
  mockId = undefined
  post.mockResolvedValue('nuevo-id')
  put.mockResolvedValue(true)
  conPermisos(PERMISOS)
})

async function datosMinimos() {
  fireEvent.changeText(screen.getByLabelText('Dirección de entrega'), 'Av. del Valle 89')
  fireEvent.changeText(screen.getByLabelText('Nombre del local'), 'Kiosco Chela')
  fireEvent.changeText(screen.getByLabelText('Contacto'), 'Chela')
  fireEvent.changeText(screen.getByLabelText('Teléfono'), '1146582291')
}

describe('editor del horario de entrega', () => {
  it('el preset "L a V" marca los cinco días, "Agregar horario" suma una fila y se puede quitar', async () => {
    renderConQuery(<ClienteFormScreen />)
    expect(screen.queryByTestId('horario-fila-0')).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar horario' }))
    expect(screen.getByTestId('horario-fila-0')).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: 'L a V' }))
    for (const d of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']) {
      expect(screen.getByRole('button', { name: d }).props.accessibilityState).toMatchObject({ selected: true })
    }
    expect(screen.getByRole('button', { name: 'Sábado' }).props.accessibilityState).toMatchObject({ selected: false })
    expect(screen.getByTestId('horario-resumen').props.children).toBe('L a V 08 a 12')

    await userEvent.press(screen.getByRole('button', { name: 'Quitar horario' }))
    expect(screen.queryByTestId('horario-fila-0')).toBeNull()
  })

  it('cada día se prende y se apaga, y el texto corto se actualiza en vivo', async () => {
    renderConQuery(<ClienteFormScreen />)
    await userEvent.press(screen.getByRole('button', { name: 'Agregar horario' }))
    await userEvent.press(screen.getByRole('button', { name: 'Lunes' }))
    await userEvent.press(screen.getByRole('button', { name: 'Miércoles' }))
    expect(screen.getByRole('button', { name: 'Lunes' }).props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.getByTestId('horario-resumen').props.children).toBe('L, X 08 a 12')
    await userEvent.press(screen.getByRole('button', { name: 'Lunes' }))
    expect(screen.getByTestId('horario-resumen').props.children).toBe('X 08 a 12')
  })

  it('una fila sin días frena el guardado y muestra el error en la fila', async () => {
    renderConQuery(<ClienteFormScreen />)
    await datosMinimos()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar horario' }))
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(ERROR_SIN_DIAS)).toBeTruthy()
    expect(screen.getByText(HORARIO_INVALIDO)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('"hasta" no posterior a "desde" se marca y no guarda', async () => {
    renderConQuery(<ClienteFormScreen />)
    await datosMinimos()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar horario' }))
    await userEvent.press(screen.getByRole('button', { name: 'Lunes' }))
    fireEvent.changeText(screen.getAllByLabelText('Hasta')[0], '07:00')
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('«Hasta» tiene que ser después de «desde».')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })
})

describe('payload del horario', () => {
  it('el alta manda una franja por día', async () => {
    renderConQuery(<ClienteFormScreen />)
    await datosMinimos()
    await userEvent.press(screen.getByRole('button', { name: 'Agregar horario' }))
    await userEvent.press(screen.getByRole('button', { name: 'L a V' }))
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1].horario).toEqual([1, 2, 3, 4, 5].map(d => f(d, '08:00', '12:00')))
  })

  it('el alta sin horario no manda el campo', async () => {
    renderConQuery(<ClienteFormScreen />)
    await datosMinimos()
    await userEvent.press(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).not.toHaveProperty('horario')
  })

  it('al editar agrupa las franjas guardadas en filas y manda lo editado', async () => {
    mockId = 'c1'
    const guardado = [...[1, 2, 3, 4, 5].map(d => f(d, '08:00', '12:00')), f(6, '09:00', '13:00')]
    ;(api.get as jest.Mock).mockResolvedValue(detalle(guardado))
    renderConQuery(<ClienteFormScreen />)

    await waitFor(() => expect(screen.getByTestId('horario-fila-1')).toBeTruthy())
    expect(screen.getByTestId('horario-resumen').props.children).toBe('L a V 08 a 12 · S 09 a 13')

    await userEvent.press(screen.getAllByRole('button', { name: 'Quitar horario' })[1])
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][1].horario).toEqual([1, 2, 3, 4, 5].map(d => f(d, '08:00', '12:00')))
  })

  it('al editar y quitar todas las filas se manda [] para vaciar el horario', async () => {
    mockId = 'c1'
    ;(api.get as jest.Mock).mockResolvedValue(detalle([f(1, '08:00', '12:00')]))
    renderConQuery(<ClienteFormScreen />)
    await waitFor(() => expect(screen.getByTestId('horario-fila-0')).toBeTruthy())
    await userEvent.press(screen.getByRole('button', { name: 'Quitar horario' }))
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][1].horario).toEqual([])
  })

  it('al editar un cliente sin horario devuelve el valor que ya tenía', async () => {
    mockId = 'c1'
    ;(api.get as jest.Mock).mockResolvedValue(detalle([]))
    renderConQuery(<ClienteFormScreen />)
    await waitFor(() => expect(screen.getByLabelText('Nombre del local').props.value).toBe('Kiosco Chela'))
    await userEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][1].horario).toEqual([])
  })
})

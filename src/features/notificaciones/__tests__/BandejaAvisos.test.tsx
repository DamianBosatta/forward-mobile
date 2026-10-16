/**
 * Bandeja de avisos (9B, fila "Bandeja de avisos y push en mobile"): lo que manda el servidor, sin
 * inventar nada. Tocar un aviso lo marca leído y, si mobile tiene la pantalla, lleva ahí; si la
 * acción es de la web (talonarios, caja…), lo dice en vez de navegar a una pantalla rota.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { BandejaAvisos } from '../BandejaAvisos'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: { get: (url: string) => mockGet(url), post: (url: string, body?: unknown) => mockPost(url, body) },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  DrawerActions: { openDrawer: jest.fn() },
}))

const aviso = (o: Record<string, unknown>) => ({
  tipo: 'VentaAutorizada', severidad: 'Info', presentacion: 'Toast', leida: false, fechaCreacion: '2026-10-16T12:05:00Z', ...o,
})
const VENTA = aviso({ id: 'n1', titulo: 'Venta A00421 autorizada', mensaje: 'Ya podés prepararla.', accion: { destino: 'Venta', entidadId: 'v-9', etiqueta: 'Ver venta' } })
const TALONARIO = aviso({
  id: 'n2', tipo: 'TalonarioRemitoPorVencer', titulo: 'El CAI vence el 20/10', mensaje: 'Cargá un talonario nuevo.',
  accion: { destino: 'ConfiguracionFacturacion', entidadId: null, etiqueta: 'Cargar talonario' },
})
const LEIDO = aviso({ id: 'n3', tipo: 'ResumenSemanal', titulo: 'Tu semana', mensaje: '3 vencimientos', leida: true, fechaCreacion: '2026-10-02T21:10:00Z' })

const urls = () => mockGet.mock.calls.map(([u]) => String(u))

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><BandejaAvisos /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-16T18:00:00Z'))
  mockGet.mockResolvedValue({ items: [VENTA, TALONARIO, LEIDO], noLeidas: 2, hayMas: false })
  mockPost.mockResolvedValue(1)
})
afterEach(() => jest.restoreAllMocks())

describe('Bandeja de avisos', () => {
  it('muestra los avisos del servidor con su tipo, hora y cuántos quedan sin leer', async () => {
    pintar()
    expect(await screen.findByText('Venta A00421 autorizada')).toBeTruthy()
    expect(urls()).toContain('/api/v1/Notificaciones?SoloNoLeidas=false&Limite=30')
    expect(screen.getByText('2 sin leer')).toBeTruthy()
    const fila = screen.getByLabelText('Venta A00421 autorizada, sin leer')
    expect(within(fila).getByText('Venta autorizada · Hoy 09:05')).toBeTruthy()
    expect(within(fila).getByText('Ya podés prepararla.')).toBeTruthy()
    expect(screen.getByLabelText('Tu semana')).toBeTruthy()
  })

  it('tocar un aviso con pantalla en mobile lo marca leído y lleva a la ficha', async () => {
    pintar()
    await userEvent.press(await screen.findByLabelText('Venta A00421 autorizada, sin leer'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Notificaciones/marcar-leidas', { ids: ['n1'] })
    expect(mockPush).toHaveBeenCalledWith('/ventas/v-9')
    expect(within(screen.getByLabelText('Venta A00421 autorizada, sin leer')).getByText('Ver venta')).toBeTruthy()
  })

  it('un aviso que se resuelve en la web lo dice y no navega', async () => {
    pintar()
    const fila = await screen.findByLabelText('El CAI vence el 20/10, sin leer')
    expect(within(fila).getByText('Cargar talonario: se abre desde la web')).toBeTruthy()
    await userEvent.press(fila)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Notificaciones/marcar-leidas', { ids: ['n2'] })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('tocar un aviso ya leído no lo vuelve a marcar', async () => {
    pintar()
    await userEvent.press(await screen.findByLabelText('Tu semana'))
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('"Marcar todas como leídas" manda la bandeja entera y vuelve a pedirla', async () => {
    pintar()
    await screen.findByText('Venta A00421 autorizada')
    mockGet.mockResolvedValue({ items: [{ ...VENTA, leida: true }], noLeidas: 0, hayMas: false })
    await userEvent.press(screen.getByLabelText('Marcar todas como leídas'))
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Notificaciones/marcar-leidas', {})
    expect(await screen.findByText('Todo leído')).toBeTruthy()
    expect(screen.getByLabelText('Marcar todas como leídas').props.accessibilityState.disabled).toBe(true)
  })

  it('"Sin leer" pide solo las no leídas', async () => {
    pintar()
    await screen.findByText('Venta A00421 autorizada')
    await userEvent.press(screen.getByText('Sin leer'))
    await waitFor(() => expect(urls()).toContain('/api/v1/Notificaciones?SoloNoLeidas=true&Limite=30'))
  })

  it('"Ver avisos anteriores" sigue desde el último con el cursor del servidor', async () => {
    mockGet.mockResolvedValueOnce({ items: [VENTA, TALONARIO], noLeidas: 2, hayMas: true })
    mockGet.mockResolvedValueOnce({ items: [LEIDO], noLeidas: 2, hayMas: false })
    pintar()
    await userEvent.press(await screen.findByText('Ver avisos anteriores'))
    expect(await screen.findByText('Tu semana')).toBeTruthy()
    expect(urls()[1]).toBe('/api/v1/Notificaciones?SoloNoLeidas=false&Limite=30&AntesDe=2026-10-16T12%3A05%3A00Z&AntesDeId=n2')
    expect(screen.queryByText('Ver avisos anteriores')).toBeNull()
  })

  it('sin avisos lo dice, y si la bandeja no carga se ve el error y se puede reintentar', async () => {
    mockGet.mockRejectedValueOnce(new Error('Sin conexión con el servidor'))
    pintar()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Sin conexión con el servidor')).toBeTruthy()
    mockGet.mockResolvedValue({ items: [], noLeidas: 0, hayMas: false })
    await userEvent.press(screen.getByText('Reintentar'))
    expect(await screen.findByText('No tenés avisos.')).toBeTruthy()
  })

  it('el engranaje lleva a las preferencias', async () => {
    pintar()
    await screen.findByText('Venta A00421 autorizada')
    await userEvent.press(screen.getByLabelText('Preferencias de avisos'))
    expect(mockPush).toHaveBeenCalledWith('/avisos/preferencias')
  })
})

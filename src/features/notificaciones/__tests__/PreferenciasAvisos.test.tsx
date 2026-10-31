/**
 * Preferencias de avisos: las mismas del servidor que usa la web (`GET/PUT
 * /Notificaciones/preferencias`). Todos los avisos quedan en la bandeja; la preferencia decide
 * cuáles saltan al llegar. Los críticos no se pueden silenciar: el servidor responde 400 si se
 * intenta, así que la pantalla ni lo ofrece.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Switch } from 'react-native'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { PreferenciasAvisos } from '../PreferenciasAvisos'

const mockGet = jest.fn()
const mockPut = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: { get: (url: string) => mockGet(url), put: (url: string, body?: unknown) => mockPut(url, body) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }))

const PREFERENCIAS = [
  { tipo: 'CajaSinCerrar', severidad: 'Critica', toast: true, silenciable: false },
  { tipo: 'VentaAutorizada', severidad: 'Info', toast: true, silenciable: true },
  { tipo: 'ResumenSemanal', severidad: 'Info', toast: false, silenciable: true },
]

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><PreferenciasAvisos /></QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue(PREFERENCIAS)
  mockPut.mockResolvedValue(1)
})

describe('Preferencias de avisos', () => {
  it('agrupa por tema y dice en palabras si salta o queda en la bandeja', async () => {
    pintar()
    await screen.findByLabelText('Venta autorizada')
    expect(screen.getByRole('header', { name: 'Ventas' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Cobros y pagos' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Calendario' })).toBeTruthy()
    expect(screen.queryByRole('header', { name: 'Facturación y stock' })).toBeNull()
    expect(screen.getByText('Salta apenas llega')).toBeTruthy()
    expect(screen.getByText('Solo en la bandeja')).toBeTruthy()
  })


  it('lista cada tipo que el servidor le manda al usuario con su estado', async () => {
    pintar()
    const venta = await screen.findByLabelText('Venta autorizada')
    expect(mockGet).toHaveBeenCalledWith('/api/v1/Notificaciones/preferencias')
    expect(venta.props.accessibilityState).toEqual(expect.objectContaining({ checked: true, disabled: false }))
    expect(screen.getByLabelText('Resumen semanal de vencimientos').props.accessibilityState.checked).toBe(false)
  })

  it('un aviso crítico queda prendido y no se puede apagar', async () => {
    pintar()
    const caja = await screen.findByLabelText('Caja sin cerrar')
    expect(caja.props.accessibilityState).toEqual(expect.objectContaining({ checked: true, disabled: true }))
    expect(screen.getByText('Crítico: no se puede silenciar')).toBeTruthy()
    await userEvent.press(caja)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('usa la fila de interruptor del sistema (FilaInterruptor): el Switch lleva el color del pulgar', async () => {
    pintar()
    const venta = await screen.findByLabelText('Venta autorizada')
    expect(within(venta).UNSAFE_getByType(Switch).props.thumbColor).toBeTruthy()
  })

  it('apagar uno guarda solo ese tipo', async () => {
    pintar()
    await userEvent.press(await screen.findByLabelText('Venta autorizada'))
    expect(mockPut).toHaveBeenCalledWith('/api/v1/Notificaciones/preferencias', { preferencias: [{ tipo: 'VentaAutorizada', toast: false }] })
  })

  it('si el servidor rechaza el cambio se ve el motivo', async () => {
    mockPut.mockRejectedValueOnce(new Error('Los avisos críticos (CajaSinCerrar) no se pueden silenciar.'))
    pintar()
    await userEvent.press(await screen.findByLabelText('Resumen semanal de vencimientos'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Los avisos críticos (CajaSinCerrar) no se pueden silenciar.')).toBeTruthy()
  })

  it('Volver regresa a la bandeja', async () => {
    pintar()
    await screen.findByLabelText('Venta autorizada')
    await userEvent.press(screen.getByLabelText('Volver'))
    expect(mockBack).toHaveBeenCalled()
  })
})

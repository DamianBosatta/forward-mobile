import React from 'react'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { ApiError } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { conTema, TEMAS } from '@/core/ui/fw/__testing__/tema'
import type { ParadaCobro } from '@/features/cobros/paradaCobro'
import { leerCola, quitarDeCola } from '../cola'
import { HojaDeRutaVista } from '../consola/HojaDeRutaVista'
import { resumenRuta } from '../consola/hojaDeRuta'

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  API_URL: 'http://api.test',
  api: { get: (url: string) => mockGet(url), post: (url: string, body?: unknown) => mockPost(url, body) },
}))
let mockAncho = 390
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockAncho, height: 800, scale: 2, fontScale: 1 }),
}))
let mockClaves = 0
jest.mock('@/features/venta-nueva/lib/payload', () => ({
  ...jest.requireActual('@/features/venta-nueva/lib/payload'),
  nuevaClaveIdempotencia: () => `clave-${++mockClaves}`,
}))

const USUARIO = 'u1'
const MEDIOS = [{ id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' }]
const entrega = (o: Record<string, unknown>) => ({
  ventaId: 'v', telefono: '', cantidadBultos: 1, latitud: 0, longitud: 0, estado: 1, montoTotal: 1000, clienteNombre: 'Abel', direccion: 'Tarantino 1898', orden: 1, ...o,
})
const cobro = (o: Partial<ParadaCobro> = {}): ParadaCobro => ({
  id: 'pc1', clienteId: 'c1', clienteNombre: 'Almacén Don Pepe', direccion: 'Av. Rivadavia 4500', orden: 1, estado: 1,
  montoAcordado: 85000, deudaCliente: 120000, ...o,
})
const rechazo = (status: number, mensaje: string, codigo?: string) => new ApiError(status, mensaje, [], codigo as never)

function pintar(paradasCobro: ParadaCobro[] | undefined, extra: { entregas?: unknown[]; puedeReportar?: boolean } = {}) {
  const detalles = (extra.entregas ?? [entrega({ id: 'p1' })]) as never[]
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <HojaDeRutaVista
        resumen={resumenRuta(detalles)}
        soloLectura={false}
        puedeReportar={extra.puedeReportar ?? true}
        onLlegue={jest.fn()} onComoLlegar={jest.fn()} onLlamar={jest.fn()} puedeLlamar={() => false} onVerPedido={jest.fn()} onNota={jest.fn()}
        notaCargando={false}
        hojaDeRutaId="h1"
        paradasCobro={paradasCobro}
        pie={<></>}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockAncho = 390
  mockClaves = 0
  useAuthStore.setState({ user: { id: USUARIO } } as never)
  mockGet.mockReset()
  mockPost.mockReset()
  mockGet.mockImplementation((url: string) => (url.endsWith('/medios-cobro') ? Promise.resolve(MEDIOS) : Promise.reject(new Error(`sin respuesta: ${url}`))))
  for (const a of leerCola(USUARIO)) quitarDeCola(USUARIO, a.clave)
  act(() => onlineManager.setOnline(true))
})

describe.each(TEMAS)('paradas de solo cobro en la consola del chofer (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('aparecen aparte de las entregas: dirección primero, cliente en otra línea, acordado y deuda', () => {
    pintar([cobro()])
    expect(screen.getByText('Solo cobro (1)')).toBeTruthy()
    expect(screen.getByLabelText('Parada 2 de solo cobro: Av. Rivadavia 4500')).toBeTruthy()
    expect(screen.getByText('2 · Av. Rivadavia 4500')).toBeTruthy()
    expect(screen.getByText('Almacén Don Pepe')).toBeTruthy()
    expect(screen.getByText('Solo cobro')).toBeTruthy()
    expect(screen.getByText(/Acordado/)).toBeTruthy()
    expect(screen.getByText(/Debe/)).toBeTruthy()
  })

  it('una parada sin dirección se identifica por el cliente, sin repetirlo', () => {
    pintar([cobro({ direccion: null })])
    expect(screen.getByText('2 · Almacén Don Pepe')).toBeTruthy()
    expect(screen.queryByText('Almacén Don Pepe')).toBeNull()
  })

  it('una hoja vieja, sin paradasCobro, se ve como siempre', () => {
    pintar(undefined)
    expect(screen.queryByText(/Solo cobro/)).toBeNull()
    expect(screen.getByLabelText('¡Llegué!')).toBeTruthy()
    expect(screen.getByText('Tarantino 1898')).toBeTruthy()
  })

  it('antes de iniciar el recorrido se ven pero no se cobran', () => {
    pintar([cobro()], { puedeReportar: false })
    expect(screen.getByText('Solo cobro (1)')).toBeTruthy()
    expect(screen.queryByLabelText('Cobrar en Av. Rivadavia 4500')).toBeNull()
  })

  it('las ya cobradas o cerradas muestran su resultado y no ofrecen cobrar', () => {
    pintar([
      cobro({ id: 'pc1', estado: 2, montoCobrado: 85000 }),
      cobro({ id: 'pc2', orden: 2, estado: 3, motivoNoCobro: 3, direccion: 'Calle 2 100' }),
    ])
    expect(screen.getByText('Cobrada')).toBeTruthy()
    expect(screen.getByText(/Cobrado/)).toBeTruthy()
    expect(screen.getByText('No cobrada')).toBeTruthy()
    expect(screen.getByText('Estaba cerrado')).toBeTruthy()
    expect(screen.queryByLabelText(/^Cobrar en/)).toBeNull()
  })

  it('con las entregas hechas y un cobro pendiente la ruta no está "completa" y el finalizar sigue a la vista', () => {
    pintar([cobro()], { entregas: [entrega({ id: 'p1', estado: 2 })] })
    expect(screen.getByText('Entregas completas.')).toBeTruthy()
    expect(screen.getByText(/Te quedan 1 parada de solo cobro\./)).toBeTruthy()
    expect(screen.queryByText('Ruta completa.')).toBeNull()
  })

  it('con las entregas hechas y sin cobros pendientes sigue diciendo "Ruta completa."', () => {
    pintar([cobro({ estado: 2, montoCobrado: 1 })], { entregas: [entrega({ id: 'p1', estado: 2 })] })
    expect(screen.getByText('Ruta completa.')).toBeTruthy()
  })

  it('la pantalla de la parada: dirección y cliente, aviso, montos y el monto acordado precargado al elegir el medio', async () => {
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    expect(await screen.findByText('Parada 2 de 2 · Solo cobro')).toBeTruthy()
    expect(screen.getByText('No llevás mercadería.')).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Registrar cobro' })).toBeTruthy()
    expect(screen.getByText('Si no pudiste cobrar')).toBeTruthy()
    await userEvent.press(await screen.findByText('Efectivo'))
    expect(screen.getByLabelText('Monto del cobro 1').props.value).toBe('85000')
    // Sin firma: es solo cobro, no hay mercadería.
    expect(screen.queryByText('Firma')).toBeNull()
  })

  it('"Registrar cobro" sin medio queda apagado con su razón', async () => {
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    expect(await screen.findByText('Elegí cómo pagó el cliente')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Registrar cobro' }).props.accessibilityState.disabled).toBe(true)
  })

  it('con señal el cobro va a /cobrar con su clave y sus líneas, y dice que entra en la rendición', async () => {
    mockPost.mockResolvedValue({ paradaCobroId: 'pc1', pagoId: 'pg1', montoCobrado: 85000, repetida: false })
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    await userEvent.press(await screen.findByText('Efectivo'))
    await userEvent.press(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(await screen.findByText('Cobro registrado.')).toBeTruthy()
    expect(screen.getByText(/Entra en tu rendición de hoy\./)).toBeTruthy()
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/paradas-cobro/pc1/cobrar', {
      claveIdempotencia: 'clave-1', lineas: [{ medioPagoId: 'm-ef', monto: 85000 }],
    })
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('un rechazo del servidor se muestra y el reintento manda la MISMA clave', async () => {
    mockPost.mockRejectedValueOnce(rechazo(400, 'El monto no coincide.')).mockResolvedValue({ paradaCobroId: 'pc1', pagoId: 'pg1', montoCobrado: 85000, repetida: false })
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    await userEvent.press(await screen.findByText('Efectivo'))
    await userEvent.press(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(await screen.findByText('El monto no coincide.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(await screen.findByText('Cobro registrado.')).toBeTruthy()
    expect(mockPost.mock.calls.map((c) => (c[1] as { claveIdempotencia: string }).claveIdempotencia)).toEqual(['clave-1', 'clave-1'])
  })

  it('sin señal el cobro queda en la cola (misma clave), no llama al servidor y la parada pasa a cobrada', async () => {
    pintar([cobro()])
    // Los medios ya se bajaron con señal; recién después se corta.
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/v1/Logistica/medios-cobro'))
    await act(async () => { await Promise.resolve() })
    act(() => onlineManager.setOnline(false))
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    await userEvent.press(await screen.findByText('Efectivo'))
    await userEvent.press(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(await screen.findByText('Cobro guardado.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
    expect(leerCola(USUARIO)).toEqual([
      expect.objectContaining({
        tipo: 'cobroParada', clave: 'clave-1', hojaDeRutaId: 'h1', paradaId: 'pc1', cobrado: 85000,
        cuerpo: { claveIdempotencia: 'clave-1', lineas: [{ medioPagoId: 'm-ef', monto: 85000 }] },
        estado: { tipo: 'esperando', intentos: 0 },
      }),
    ])
    await userEvent.press(screen.getByText('Volver a la ruta'))
    expect(await screen.findByText('Cobrada')).toBeTruthy()
    expect(screen.queryByLabelText('Cobrar en Av. Rivadavia 4500')).toBeNull()
  })

  it('"No cobré" exige el motivo: sin elegirlo "Cerrar sin cobrar" está apagado con su razón', async () => {
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    await userEvent.press(await screen.findByText('No cobré'))
    expect(screen.getByText('Falta elegir el motivo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cerrar sin cobrar' }).props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('Ya pagó')).toBeTruthy()
    expect(screen.getByText('No pagó')).toBeTruthy()
    expect(screen.getByText('Estaba cerrado')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('con el motivo elegido y señal manda /no-cobrada con el motivo y dice que la parada se cerró', async () => {
    mockPost.mockResolvedValue({})
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    await userEvent.press(await screen.findByText('No cobré'))
    await userEvent.press(screen.getByText('Estaba cerrado'))
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sin cobrar' }))
    expect(await screen.findByText('Parada cerrada sin cobrar.')).toBeTruthy()
    expect(mockPost).toHaveBeenCalledWith('/api/v1/Logistica/hojas-ruta/h1/paradas-cobro/pc1/no-cobrada', { motivo: 3 })
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('sin señal "No cobré" queda en la cola con su motivo, una sola vez por parada', async () => {
    act(() => onlineManager.setOnline(false))
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    await userEvent.press(await screen.findByText('No cobré'))
    await userEvent.press(screen.getByText('No pagó'))
    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sin cobrar' }))
    expect(await screen.findByText('Parada guardada sin cobrar.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
    expect(leerCola(USUARIO)).toEqual([
      expect.objectContaining({ tipo: 'noCobroParada', clave: 'no-cobrada:pc1', paradaId: 'pc1', cuerpo: { motivo: 2 } }),
    ])
  })

  it('un 409 de "ya reportada" se muestra tal cual, sin dar la parada por cobrada', async () => {
    mockPost.mockRejectedValue(rechazo(409, 'La parada ya fue reportada.', 'ParadaYaReportada'))
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    await userEvent.press(await screen.findByText('Efectivo'))
    await userEvent.press(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(await screen.findByText('La parada ya fue reportada.')).toBeTruthy()
    expect(screen.queryByText('Cobro registrado.')).toBeNull()
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('en tablet la pantalla de la parada queda en una columna', async () => {
    mockAncho = 1024
    pintar([cobro()])
    await userEvent.press(screen.getByLabelText('Cobrar en Av. Rivadavia 4500'))
    expect(await screen.findByText('No llevás mercadería.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeTruthy()
  })
})

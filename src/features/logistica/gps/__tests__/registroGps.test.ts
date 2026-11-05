import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { ApiError } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { leerPosiciones, descartarPosicionesDelViaje } from '../colaPosiciones'
import { MAX_POSICIONES_POR_LOTE } from '../enviarPosiciones'
import {
  TAREA_GPS, aceptarPermisoGps, comenzarRegistroGps, enviarPosiciones, rechazarPermisoGps, terminarRegistroGps,
} from '../registroGps'

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
}))
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }))
const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { post: (url: string, body?: unknown) => mockPost(url, body) },
}))

const loc = Location as jest.Mocked<typeof Location>
// La app define la tarea una sola vez, al cargar el módulo: se guarda antes de que un test limpie los mocks.
const tarea = (TaskManager.defineTask as jest.Mock).mock.calls.find(([nombre]) => nombre === TAREA_GPS)?.[1] as
  | ((b: { data?: unknown; error?: unknown }) => Promise<void>)
  | undefined

const USUARIO = 'u1'
const HOJA = 'h1'
const permiso = (granted: boolean, canAskAgain = true) => ({ granted, canAskAgain, status: granted ? 'granted' : 'denied' }) as never
const lectura = (timestamp: number, extra: Record<string, unknown> = {}) => ({
  timestamp, coords: { latitude: -34.6, longitude: -58.4, accuracy: 12.34, speed: 10, ...extra },
})
const llega = (...locations: unknown[]) => tarea!({ data: { locations } })
const sinRed = () => new TypeError('Network request failed')
const rechazo = (status: number, codigo?: string) => new ApiError(status, 'no', [], codigo as never)
const pasaUnTurno = () => new Promise((r) => setImmediate(r))
const conSesion = () => useAuthStore.setState({ user: { id: USUARIO }, isAuthenticated: true } as never)
let registrando = false

beforeEach(async () => {
  loc.getForegroundPermissionsAsync.mockReset()
  loc.requestForegroundPermissionsAsync.mockReset()
  loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(true))
  loc.requestForegroundPermissionsAsync.mockResolvedValue(permiso(true))
  loc.hasStartedLocationUpdatesAsync.mockImplementation(async () => registrando)
  loc.startLocationUpdatesAsync.mockImplementation(async () => { registrando = true })
  loc.stopLocationUpdatesAsync.mockImplementation(async () => { registrando = false })
  mockPost.mockReset()
  mockPost.mockResolvedValue({ recibidas: 1, descartadas: 0 })
  // Cada test arranca sin viaje activo, sin cola y sin viaje marcado: lo que haga esta limpieza no cuenta.
  conSesion()
  useAuthStore.setState({ isAuthenticated: false } as never)
  await pasaUnTurno()
  conSesion()
  for (const p of leerPosiciones(USUARIO)) descartarPosicionesDelViaje(USUARIO, p.hojaDeRutaId)
  await terminarRegistroGps('sin-viaje', USUARIO)
  registrando = false
  jest.clearAllMocks()
})

describe('al iniciar el recorrido', () => {
  it('con permiso arranca el registro cada 60 s, precisión balanceada y la notificación del servicio', async () => {
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('registrando')
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1)
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledWith(TAREA_GPS, expect.objectContaining({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      foregroundService: expect.objectContaining({ notificationTitle: 'Forward está registrando el viaje' }),
    }))
  })

  it('sin permiso ni forma de pedirlo no arranca, no falla y el viaje sigue', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(false, false))
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('sinPermiso')
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled()
  })

  it('una falla del módulo nativo tampoco frena el viaje', async () => {
    loc.getForegroundPermissionsAsync.mockRejectedValueOnce(new Error('nativo'))
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('sinPermiso')
    loc.startLocationUpdatesAsync.mockRejectedValueOnce(new Error('servicio'))
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('sinPermiso')
  })

  it('si todavía no se preguntó, primero se explica: el pedido del sistema sale recién al aceptar', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(false, true))
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('preguntar')
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled()
    await expect(aceptarPermisoGps(HOJA, USUARIO)).resolves.toBe('registrando')
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1)
  })

  it('negar el pedido del sistema deja el viaje sin ubicación', async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue(permiso(false, false))
    await expect(aceptarPermisoGps(HOJA, USUARIO)).resolves.toBe('sinPermiso')
    expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled()
  })

  it('"Ahora no" no se vuelve a preguntar en ese viaje, pero sí en el siguiente', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permiso(false, true))
    rechazarPermisoGps(HOJA, USUARIO)
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('omitido')
    await expect(comenzarRegistroGps('h2', USUARIO)).resolves.toBe('preguntar')
  })

  it('dos pedidos a la vez arrancan una sola vez', async () => {
    await Promise.all([comenzarRegistroGps(HOJA, USUARIO), comenzarRegistroGps(HOJA, USUARIO)])
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1)
  })
})

describe('cuándo se detiene', () => {
  it('al finalizar el viaje', async () => {
    await comenzarRegistroGps(HOJA, USUARIO)
    await terminarRegistroGps(HOJA, USUARIO)
    expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledWith(TAREA_GPS)
    // La pantalla puede volver a pintar el viaje cacheado "en curso": no se vuelve a arrancar.
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('omitido')
    expect(loc.startLocationUpdatesAsync).toHaveBeenCalledTimes(1)
  })

  it('al finalizar sube lo que quedó en cola: el servidor lo acepta hasta la hora de llegada', async () => {
    await comenzarRegistroGps(HOJA, USUARIO)
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(lectura(1000))
    expect(leerPosiciones(USUARIO)).toHaveLength(1)
    await terminarRegistroGps(HOJA, USUARIO)
    expect(leerPosiciones(USUARIO)).toEqual([])
    expect(mockPost).toHaveBeenCalledTimes(2)
  })

  it('al cerrar sesión: frena y conserva la cola, y al volver a entrar el viaje en curso retoma', async () => {
    await comenzarRegistroGps(HOJA, USUARIO)
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(lectura(1000))
    useAuthStore.setState({ user: null, isAuthenticated: false } as never)
    await pasaUnTurno()
    expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledWith(TAREA_GPS)
    expect(leerPosiciones(USUARIO)).toHaveLength(1)
    conSesion()
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('registrando')
  })

  it('una lectura que llega con la sesión de otro no se guarda y frena la tarea', async () => {
    await comenzarRegistroGps(HOJA, USUARIO)
    useAuthStore.setState({ user: { id: 'otro' } } as never)
    await llega(lectura(1000))
    expect(leerPosiciones(USUARIO)).toEqual([])
    expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledWith(TAREA_GPS)
  })

  it('una lectura tardía sin viaje activo no se guarda', async () => {
    await llega(lectura(1000))
    expect(leerPosiciones(USUARIO)).toEqual([])
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('la cola de posiciones', () => {
  beforeEach(async () => {
    await comenzarRegistroGps(HOJA, USUARIO)
  })

  it('sin señal guarda cada lectura con su hora original y la manda después con esa hora', async () => {
    mockPost.mockRejectedValue(sinRed())
    await llega(lectura(Date.UTC(2026, 10, 5, 12, 0, 0)))
    await llega(lectura(Date.UTC(2026, 10, 5, 12, 1, 0)))
    expect(leerPosiciones(USUARIO).map((p) => p.registradaEn)).toEqual(['2026-11-05T12:00:00.000Z', '2026-11-05T12:01:00.000Z'])
    mockPost.mockReset()
    mockPost.mockResolvedValue({ recibidas: 2, descartadas: 0 })
    await expect(enviarPosiciones(USUARIO)).resolves.toBe('completa')
    expect(mockPost).toHaveBeenCalledWith(`/api/v1/Logistica/hojas-ruta/${HOJA}/posiciones`, {
      posiciones: [
        { latitud: -34.6, longitud: -58.4, precisionMetros: 12.3, velocidadKmh: 36, registradaEn: '2026-11-05T12:00:00.000Z' },
        { latitud: -34.6, longitud: -58.4, precisionMetros: 12.3, velocidadKmh: 36, registradaEn: '2026-11-05T12:01:00.000Z' },
      ],
    })
    expect(leerPosiciones(USUARIO)).toEqual([])
  })

  it('la misma lectura dos veces queda una sola, y lo que el servidor rechazaría por forma no entra', async () => {
    mockPost.mockRejectedValue(sinRed())
    await llega(lectura(1000), lectura(1000), lectura(2000, { latitude: 91 }), lectura(3000, { longitude: -181 }), lectura(4000, { speed: -1, accuracy: null }))
    const guardadas = leerPosiciones(USUARIO)
    expect(guardadas.map((p) => p.registradaEn)).toEqual([new Date(1000).toISOString(), new Date(4000).toISOString()])
    expect(guardadas[1]).not.toHaveProperty('velocidadKmh')
    expect(guardadas[1]).not.toHaveProperty('precisionMetros')
  })

  it('sube en lotes de hasta 120, los más viejos primero', async () => {
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(...Array.from({ length: 130 }, (_, i) => lectura(1000 * (i + 1))))
    mockPost.mockClear()
    await expect(enviarPosiciones(USUARIO)).resolves.toBe('completa')
    expect(MAX_POSICIONES_POR_LOTE).toBe(120)
    const lotes = mockPost.mock.calls.map(([, cuerpo]) => cuerpo.posiciones)
    expect(lotes.map((l) => l.length)).toEqual([120, 10])
    expect(lotes[0][0].registradaEn).toBe(new Date(1000).toISOString())
    expect(lotes[1][9].registradaEn).toBe(new Date(130_000).toISOString())
  })

  it('no pasa de 5 lotes por ronda: el servidor admite 6 llamadas por minuto y el resto queda', async () => {
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(...Array.from({ length: 700 }, (_, i) => lectura(1000 * (i + 1))))
    mockPost.mockClear()
    await expect(enviarPosiciones(USUARIO)).resolves.toBe('quedan')
    expect(mockPost).toHaveBeenCalledTimes(5)
    expect(leerPosiciones(USUARIO)).toHaveLength(100)
  })

  it.each([
    ['429', () => rechazo(429)], ['500', () => rechazo(500)], ['401', () => rechazo(401)], ['sin red', sinRed],
  ])('ante %s conserva todo, sigue registrando y reintenta después', async (_n, error) => {
    mockPost.mockRejectedValue(error())
    await llega(lectura(1000))
    await expect(enviarPosiciones(USUARIO)).resolves.toBe('sinSenal')
    expect(leerPosiciones(USUARIO)).toHaveLength(1)
    expect(loc.stopLocationUpdatesAsync).not.toHaveBeenCalled()
  })

  it.each([
    ['409 ViajeNoEnCurso', () => rechazo(409, 'ViajeNoEnCurso')],
    ['409 ViajeVencido', () => rechazo(409, 'ViajeVencido')],
    ['403', () => rechazo(403)],
    ['404', () => rechazo(404)],
  ])('ante %s frena la tarea, descarta la cola de ese viaje y no reintenta ni vuelve a arrancar', async (_n, error) => {
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(lectura(1000), lectura(2000))
    mockPost.mockReset()
    mockPost.mockRejectedValue(error())
    await enviarPosiciones(USUARIO)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledWith(TAREA_GPS)
    expect(leerPosiciones(USUARIO)).toEqual([])
    await expect(comenzarRegistroGps(HOJA, USUARIO)).resolves.toBe('omitido')
  })

  it('un viaje rechazado no se lleva la cola de otro ni frena la tarea del viaje activo', async () => {
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(lectura(1000))
    await comenzarRegistroGps('h2', USUARIO)
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(lectura(2000))
    mockPost.mockReset()
    mockPost.mockImplementation(async (url: string) => {
      if (url.includes(`/${HOJA}/`)) throw rechazo(404)
      return { recibidas: 1, descartadas: 0 }
    })
    await expect(enviarPosiciones(USUARIO)).resolves.toBe('completa')
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(leerPosiciones(USUARIO)).toEqual([])
    expect(loc.stopLocationUpdatesAsync).not.toHaveBeenCalled()
  })

  it('un 400 no traba la cola: ese lote se saca y el registro sigue', async () => {
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(lectura(1000))
    mockPost.mockReset()
    mockPost.mockRejectedValue(rechazo(400))
    await enviarPosiciones(USUARIO)
    expect(leerPosiciones(USUARIO)).toEqual([])
    expect(loc.stopLocationUpdatesAsync).not.toHaveBeenCalled()
  })

  it('no manda la cola de otro usuario con la sesión de este', async () => {
    mockPost.mockRejectedValueOnce(sinRed())
    await llega(lectura(1000))
    mockPost.mockClear()
    useAuthStore.setState({ user: { id: 'otro' } } as never)
    await enviarPosiciones(USUARIO)
    expect(mockPost).not.toHaveBeenCalled()
    expect(leerPosiciones(USUARIO)).toHaveLength(1)
  })
})

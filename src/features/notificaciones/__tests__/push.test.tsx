/**
 * Push de avisos (9B, T9): registrar el celular al iniciar sesión, darlo de baja al cerrarla, no
 * molestar cuando no se puede (sin permiso, Expo Go, sin projectId, servidor viejo) y, al tocar un
 * push, hacer lo mismo que la bandeja con la acción del aviso.
 */
import React from 'react'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ESTADOS_ESPERADOS_PUSH } from '@/libs/api-client/notificaciones'
import { PushDeAvisos } from '../PushDeAvisos'
import {
  TOPE_BAJA_ANTES_DE_SALIR_MS, bajaDePushAlCerrarSesion, darDeBajaPushAntesDeSalir, leerDatosPush, registrarPush, reiniciarEstadoPush,
} from '../push'

const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/core/api/client', () => ({
  api: {
    get: jest.fn(),
    post: (url: string, body?: unknown, opciones?: unknown) => mockPost(url, body, opciones),
    delete: (url: string, body?: unknown, opciones?: unknown) => mockDelete(url, body, opciones),
  },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockConstants = {
  executionEnvironment: 'standalone',
  expoConfig: { extra: { eas: { projectId: 'proyecto-eas' } } } as unknown,
  easConfig: undefined as unknown,
}
jest.mock('expo-constants', () => ({
  __esModule: true,
  // Getter: el factory corre al importar push.ts, antes de que mockConstants exista.
  get default() { return mockConstants },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}))

const TOKEN = 'ExponentPushToken[celular-1]'
const mockPermiso = jest.fn()
const mockPedirPermiso = jest.fn()
const mockToken = jest.fn()
let mockAlTocar: ((r: unknown) => void) | null = null
const mockUltimaRespuesta = jest.fn()
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: () => mockPermiso(),
  requestPermissionsAsync: () => mockPedirPermiso(),
  getExpoPushTokenAsync: (o: unknown) => mockToken(o),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: (cb: (r: unknown) => void) => {
    mockAlTocar = cb
    return { remove: jest.fn() }
  },
  getLastNotificationResponseAsync: () => mockUltimaRespuesta(),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}))

const respuesta = (id: string, data: unknown) => ({
  notification: { request: { identifier: id, content: { data } } },
})

function iniciarSesion(accessToken = 'acceso-1') {
  act(() => useAuthStore.getState().setTokens({ accessToken, refreshToken: 'r' }))
}

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><PushDeAvisos /></QueryClientProvider>)
}

const registros = () => mockPost.mock.calls.filter(([u]) => u === '/api/v1/Notificaciones/dispositivos')

beforeEach(() => {
  jest.clearAllMocks()
  reiniciarEstadoPush()
  mockAlTocar = null
  mockConstants.executionEnvironment = 'standalone'
  mockConstants.expoConfig = { extra: { eas: { projectId: 'proyecto-eas' } } }
  mockPermiso.mockResolvedValue({ status: 'granted' })
  mockPedirPermiso.mockResolvedValue({ status: 'granted' })
  mockToken.mockResolvedValue({ data: TOKEN })
  mockPost.mockResolvedValue(undefined)
  mockDelete.mockResolvedValue(undefined)
  mockUltimaRespuesta.mockResolvedValue(null)
  act(() => useAuthStore.getState().logout())
  mockDelete.mockClear()
})

describe('Registro del celular', () => {
  it('al iniciar sesión pide el permiso y registra el token con la plataforma', async () => {
    mockPermiso.mockResolvedValue({ status: 'undetermined' })
    pintar()
    expect(registros()).toHaveLength(0)

    iniciarSesion()

    await waitFor(() => expect(registros()).toHaveLength(1))
    expect(mockPedirPermiso).toHaveBeenCalledTimes(1)
    expect(mockToken).toHaveBeenCalledWith({ projectId: 'proyecto-eas' })
    const [, cuerpo, opciones] = registros()[0]
    expect(cuerpo).toEqual({ token: TOKEN, plataforma: 'ios' })
    expect(opciones).toMatchObject({ estadosEsperados: ESTADOS_ESPERADOS_PUSH })
  })

  it('al abrir la app con la sesión ya iniciada también registra', async () => {
    iniciarSesion()
    pintar()
    await waitFor(() => expect(registros()).toHaveLength(1))
  })

  it('sin permiso no registra nada ni muestra error', async () => {
    mockPermiso.mockResolvedValue({ status: 'undetermined' })
    mockPedirPermiso.mockResolvedValue({ status: 'denied' })

    await registrarPush()

    expect(mockToken).not.toHaveBeenCalled()
    expect(registros()).toHaveLength(0)
  })

  it('en Expo Go o sin projectId no pide permiso ni registra', async () => {
    mockConstants.executionEnvironment = 'storeClient'
    await registrarPush()
    mockConstants.executionEnvironment = 'standalone'
    mockConstants.expoConfig = { extra: {} }
    await registrarPush()

    expect(mockPermiso).not.toHaveBeenCalled()
    expect(registros()).toHaveLength(0)
  })

  it('un simulador que no da token no rompe nada', async () => {
    mockToken.mockRejectedValue(new Error('Must use physical device'))

    await expect(registrarPush()).resolves.toBeUndefined()
    expect(registros()).toHaveLength(0)
  })

  it('un servidor sin el endpoint (404) es un estado esperado: no tira ni se reporta', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))

    await expect(registrarPush()).resolves.toBeUndefined()

    expect(ESTADOS_ESPERADOS_PUSH).toEqual(expect.arrayContaining([400, 404, 405]))
    expect(registros()[0][2]).toMatchObject({ estadosEsperados: ESTADOS_ESPERADOS_PUSH })
  })
})

describe('Baja al cerrar sesión', () => {
  it('al cerrar la sesión borra el token con la sesión que se cerraba', async () => {
    pintar()
    iniciarSesion('acceso-viejo')
    await waitFor(() => expect(registros()).toHaveLength(1))

    act(() => useAuthStore.getState().logout())

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1))
    const [url, cuerpo, opciones] = mockDelete.mock.calls[0]
    expect(url).toBe('/api/v1/Notificaciones/dispositivos')
    expect(cuerpo).toEqual({ token: TOKEN })
    expect(opciones).toMatchObject({
      estadosEsperados: ESTADOS_ESPERADOS_PUSH,
      headers: { Authorization: 'Bearer acceso-viejo' },
    })
  })

  it('la baja antes de salir no se repite al cerrarse la sesión', async () => {
    pintar()
    iniciarSesion()
    await waitFor(() => expect(registros()).toHaveLength(1))

    await darDeBajaPushAntesDeSalir()
    act(() => useAuthStore.getState().logout())
    await act(async () => {})

    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('una baja que falla no tira (cerrar la sesión no depende de esto)', async () => {
    mockDelete.mockRejectedValue(new Error('sin red'))
    iniciarSesion()
    await registrarPush()

    await expect(darDeBajaPushAntesDeSalir()).resolves.toBeUndefined()
  })
})

describe('Baja: tope y sesión nueva', () => {
  afterEach(() => jest.useRealTimers())

  it('con la baja colgada, "Salir" espera como mucho el tope y no manda una segunda baja', async () => {
    iniciarSesion()
    await registrarPush()
    mockDelete.mockReturnValue(new Promise(() => {}))
    jest.useFakeTimers()
    const desuscribir = bajaDePushAlCerrarSesion()

    let listo = false
    void darDeBajaPushAntesDeSalir().then(() => { listo = true })
    await act(async () => { await jest.advanceTimersByTimeAsync(TOPE_BAJA_ANTES_DE_SALIR_MS - 1) })
    expect(listo).toBe(false)
    await act(async () => { await jest.advanceTimersByTimeAsync(1) })
    expect(listo).toBe(true)
    expect(TOPE_BAJA_ANTES_DE_SALIR_MS).toBeLessThanOrEqual(3000)

    act(() => useAuthStore.getState().logout())
    await act(async () => { await jest.advanceTimersByTimeAsync(10) })
    expect(mockDelete).toHaveBeenCalledTimes(1)
    desuscribir()
  })

  it('la baja de respaldo no sale si al enviarla ya hay otra sesión iniciada', async () => {
    iniciarSesion('acceso-de-ana')
    const desuscribir = bajaDePushAlCerrarSesion()

    act(() => useAuthStore.getState().logout())
    iniciarSesion('acceso-de-beto')
    await act(async () => {})

    expect(mockToken).toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
    desuscribir()
  })

  it('sin otra sesión, la baja de respaldo sale con el token de la sesión que se cerró', async () => {
    iniciarSesion('acceso-de-ana')
    const desuscribir = bajaDePushAlCerrarSesion()

    act(() => useAuthStore.getState().logout())
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1))

    expect(mockDelete.mock.calls[0][2]).toMatchObject({ headers: { Authorization: 'Bearer acceso-de-ana' } })
    desuscribir()
  })
})

describe('Tocar un push', () => {
  it('lo marca leído y lleva a la pantalla de su acción, igual que la bandeja', async () => {
    iniciarSesion()
    pintar()
    await waitFor(() => expect(mockAlTocar).not.toBeNull())

    act(() => mockAlTocar!(respuesta('p1', {
      notificacionId: 'n-1', accion: { destino: 'Venta', entidadId: 'v-9', etiqueta: 'Ver venta' },
    })))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/Notificaciones/marcar-leidas', { ids: ['n-1'] }, undefined))
    expect(mockPush).toHaveBeenCalledWith('/ventas/v-9')
  })

  it('una acción que mobile no tiene (la caja) lleva a la bandeja', async () => {
    iniciarSesion()
    pintar()
    await waitFor(() => expect(mockAlTocar).not.toBeNull())

    act(() => mockAlTocar!(respuesta('p2', { notificacionId: 'n-2', accion: { destino: 'Caja', entidadId: null, etiqueta: 'Ir a caja' } })))

    expect(mockPush).toHaveBeenCalledWith('/avisos')
  })

  it('el push que abrió la app se atiende una sola vez', async () => {
    const abrio = respuesta('p3', { notificacionId: 'n-3', accion: { destino: 'Calendario', entidadId: null, etiqueta: 'Ver calendario' } })
    mockUltimaRespuesta.mockResolvedValue(abrio)
    iniciarSesion()
    pintar()

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/calendario'))
    act(() => mockAlTocar!(abrio))

    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('sin sesión no navega', async () => {
    pintar()
    await act(async () => {})

    expect(mockAlTocar).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('leerDatosPush', () => {
  it('acepta lo que manda el servidor y descarta formas desconocidas', () => {
    expect(leerDatosPush({ notificacionId: 'n', accion: { destino: 'Venta', entidadId: 'v', etiqueta: 'Ver venta' } }))
      .toEqual({ notificacionId: 'n', accion: { destino: 'Venta', entidadId: 'v', etiqueta: 'Ver venta' } })
    expect(leerDatosPush({ notificacionId: 'n' })).toEqual({ notificacionId: 'n', accion: null })
    expect(leerDatosPush({ otro: 1 })).toBeNull()
    expect(leerDatosPush(null)).toBeNull()
  })
})

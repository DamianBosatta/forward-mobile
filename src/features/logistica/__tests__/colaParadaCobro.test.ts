import { ApiError } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { ParadaCobro } from '@/features/cobros/paradaCobro'
import {
  encolarAccion, leerCola, quitarDeCola, type DatosAccion,
} from '../cola/colaConsola'
import { enviarPendientesConsola } from '../cola/enviarConsola'
import { conAccionesCobroEnCola } from '../cola/conAccionesEnCola'
import { queEs } from '../cola/PildoraColaConsola'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { post: (url: string, body?: unknown) => mockPost(url, body) },
}))

const USUARIO = 'u1'
const HOJA = '/api/v1/Logistica/hojas-ruta/h1'
const cobro = (o: Partial<DatosAccion> = {}): DatosAccion => ({
  tipo: 'cobroParada', clave: 'k-cobro', hojaDeRutaId: 'h1', paradaId: 'pc1', clienteNombre: 'Almacén Don Pepe',
  cuerpo: { claveIdempotencia: 'k-cobro', lineas: [{ medioPagoId: 'm1', monto: 85000 }] }, cobrado: 85000, ...o,
} as DatosAccion)
const noCobro = (o: Partial<DatosAccion> = {}): DatosAccion => ({
  tipo: 'noCobroParada', clave: 'no-cobrada:pc2', hojaDeRutaId: 'h1', paradaId: 'pc2', clienteNombre: 'Kiosco Los Pibes',
  cuerpo: { motivo: 2 }, ...o,
} as DatosAccion)
const entrega = (): DatosAccion => ({
  tipo: 'entrega', clave: 'k-e', hojaDeRutaId: 'h1', paradaId: 'p1', clienteNombre: 'Marta',
  cuerpo: { claveIdempotencia: 'k-e' }, cobrado: 0, conDevolucion: false,
} as DatosAccion)
const rechazo = (status: number, mensaje: string, codigo?: string) => new ApiError(status, mensaje, [], codigo as never)

beforeEach(() => {
  useAuthStore.setState({ user: { id: USUARIO } } as never)
  mockPost.mockReset()
  for (const a of leerCola(USUARIO)) quitarDeCola(USUARIO, a.clave)
})

describe('cobro de una parada de solo cobro sin señal', () => {
  it('manda el cobro a /paradas-cobro/{id}/cobrar con su clave, sus líneas y la hora del celular; vacía la cola', async () => {
    mockPost.mockResolvedValue({})
    encolarAccion(USUARIO, cobro(), 1_700_000_000_000)
    const alEnviar = jest.fn()
    await expect(enviarPendientesConsola(USUARIO, { alEnviar })).resolves.toBe('completa')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(`${HOJA}/paradas-cobro/pc1/cobrar`, {
      claveIdempotencia: 'k-cobro', lineas: [{ medioPagoId: 'm1', monto: 85000 }], resueltaEn: new Date(1_700_000_000_000).toISOString(),
    })
    expect(leerCola(USUARIO)).toEqual([])
    expect(alEnviar).toHaveBeenCalledWith('h1')
  })

  it('"No cobré" va a /no-cobrada con el motivo y la hora; guardada sobrevive a releer la cola', async () => {
    mockPost.mockResolvedValue({})
    const a = encolarAccion(USUARIO, noCobro(), 1_700_000_000_000)
    expect(leerCola(USUARIO)).toEqual([a])
    await enviarPendientesConsola(USUARIO)
    expect(mockPost).toHaveBeenCalledWith(`${HOJA}/paradas-cobro/pc2/no-cobrada`, {
      motivo: 2, resueltaEn: new Date(1_700_000_000_000).toISOString(),
    })
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('mantiene el orden de llegada entre entregas y paradas de cobro, una por vez', async () => {
    const orden: string[] = []
    mockPost.mockImplementation(async (url: string) => { orden.push(url.replace(HOJA, '')) })
    encolarAccion(USUARIO, noCobro(), 3000)
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, cobro(), 2000)
    await enviarPendientesConsola(USUARIO)
    expect(orden).toEqual(['/paradas/p1/entregar', '/paradas-cobro/pc1/cobrar', '/paradas-cobro/pc2/no-cobrada'])
  })

  it('el mismo cobro encolado dos veces queda una sola vez (misma clave)', () => {
    encolarAccion(USUARIO, cobro(), 1000)
    encolarAccion(USUARIO, cobro(), 2000)
    expect(leerCola(USUARIO)).toHaveLength(1)
  })

  it.each(['ParadaYaReportada', 'ClaveIdempotenciaConOtroCuerpo', 'Duplicado', 'ParadaCobroSinViajeEnCurso'])(
    'un 409 %s NO da el cobro por enviado: queda para revisar con el mensaje y la ronda sigue',
    async (codigo) => {
      mockPost.mockRejectedValueOnce(rechazo(409, 'La parada ya fue reportada.', codigo)).mockResolvedValue({})
      encolarAccion(USUARIO, cobro(), 1000)
      encolarAccion(USUARIO, noCobro(), 2000)
      const alFallar = jest.fn()
      await expect(enviarPendientesConsola(USUARIO, { alFallar })).resolves.toBe('completa')
      const [primera] = leerCola(USUARIO)
      expect(primera).toMatchObject({ clave: 'k-cobro', estado: { tipo: 'revisar', mensaje: 'La parada ya fue reportada.' } })
      expect(leerCola(USUARIO)).toHaveLength(1)
      expect(alFallar).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledTimes(2)
    },
  )

  it('sin señal el cobro sigue esperando con un intento más y no se manda lo que viene detrás', async () => {
    mockPost.mockRejectedValue(rechazo(503, 'caído'))
    encolarAccion(USUARIO, cobro(), 1000)
    encolarAccion(USUARIO, noCobro(), 2000)
    await expect(enviarPendientesConsola(USUARIO)).resolves.toBe('sinSenal')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(leerCola(USUARIO)[0].estado).toEqual({ tipo: 'esperando', intentos: 1 })
  })

  it('sigue valiendo: una entrega con 409 ya registrada se da por enviada', async () => {
    mockPost.mockRejectedValue(rechazo(409, 'La parada ya fue reportada.'))
    encolarAccion(USUARIO, entrega(), 1000)
    await enviarPendientesConsola(USUARIO)
    expect(leerCola(USUARIO)).toEqual([])
  })
})

describe('paradas de cobro con lo que espera en la cola', () => {
  const parada = (o: Partial<ParadaCobro>): ParadaCobro => ({ id: 'pc1', clienteId: 'c1', clienteNombre: 'Don Pepe', orden: 1, estado: 1, deudaCliente: 1, ...o })

  it('lo cobrado o cerrado sin señal ya cuenta como hecho; lo que el servidor ya resolvió manda; lo que hay que revisar no', () => {
    const lista = [parada({ id: 'pc1' }), parada({ id: 'pc2' }), parada({ id: 'pc3', estado: 3 }), parada({ id: 'pc4' })]
    const acciones = [
      { ...cobro(), encoladaEn: 1, estado: { tipo: 'esperando', intentos: 0 } },
      { ...noCobro(), encoladaEn: 2, estado: { tipo: 'esperando', intentos: 0 } },
      { ...cobro({ paradaId: 'pc3', clave: 'x' }), encoladaEn: 3, estado: { tipo: 'esperando', intentos: 0 } },
      { ...cobro({ paradaId: 'pc4', clave: 'y' }), encoladaEn: 4, estado: { tipo: 'revisar', mensaje: 'no' } },
    ] as never
    expect(conAccionesCobroEnCola(lista, acciones).map((p) => p.estado)).toEqual([2, 3, 3, 1])
  })

  it('sin acciones devuelve la misma lista', () => {
    const lista = [parada({})]
    expect(conAccionesCobroEnCola(lista, [])).toBe(lista)
  })
})

describe('la píldora de la cola dice qué hizo el chofer', () => {
  it('"Cobro" y "No cobré"; lo de siempre no cambia', () => {
    const base = { encoladaEn: 1, estado: { tipo: 'esperando', intentos: 0 } }
    expect(queEs({ ...cobro(), ...base } as never)).toBe('Cobro')
    expect(queEs({ ...noCobro(), ...base } as never)).toBe('No cobré')
    expect(queEs({ ...entrega(), ...base, cobrado: 10, conDevolucion: true } as never)).toBe('Entrega, cobro y devolución')
  })
})

import { ApiError } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import {
  encolarAccion, leerCola, quitarDeCola, suscribirCola, textoDeCola, type DatosAccion,
} from '../cola/colaConsola'
import { enviarPendientesConsola } from '../cola/enviarConsola'

const mockPost = jest.fn()
jest.mock('@/core/api/client', () => ({
  ...jest.requireActual('@/core/api/client'),
  api: { post: (url: string, body?: unknown) => mockPost(url, body) },
}))

const USUARIO = 'u1'
const entrega = (o: Partial<DatosAccion> = {}): DatosAccion => ({
  tipo: 'entrega', clave: 'k-1', hojaDeRutaId: 'h1', paradaId: 'p1', clienteNombre: 'Almacén Don Pepe',
  cuerpo: { claveIdempotencia: 'k-1', nombreReceptor: 'Marta' }, cobrado: 160000, conDevolucion: true, ...o,
} as DatosAccion)
const noEntrega = (o: Partial<DatosAccion> = {}): DatosAccion => ({
  tipo: 'noEntrega', clave: 'k-2', hojaDeRutaId: 'h1', paradaId: 'p2', clienteNombre: 'Kiosco Los Pibes',
  cuerpo: { entregado: false, motivoRechazo: 'Cerrado' }, ...o,
} as DatosAccion)
const rechazo = (status: number, mensaje: string, codigo?: string) => new ApiError(status, mensaje, [], codigo as never)

beforeEach(() => {
  useAuthStore.setState({ user: { id: USUARIO } } as never)
  mockPost.mockReset()
  for (const a of leerCola(USUARIO)) quitarDeCola(USUARIO, a.clave)
})

describe('cola de la consola sin señal', () => {
  it('guarda la acción con su clave, la hora y estado esperando; encolar la misma clave dos veces deja una sola', () => {
    const a = encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, entrega(), 2000)
    expect(leerCola(USUARIO)).toEqual([a])
    expect(a).toMatchObject({ clave: 'k-1', encoladaEn: 1000, estado: { tipo: 'esperando', intentos: 0 } })
    expect(textoDeCola(USUARIO)).toContain('k-1')
  })

  it('cada usuario ve solo su cola y los oyentes se enteran de cada cambio', () => {
    const oyente = jest.fn()
    const baja = suscribirCola(oyente)
    encolarAccion(USUARIO, entrega())
    expect(oyente).toHaveBeenCalledTimes(1)
    expect(leerCola('otro')).toEqual([])
    baja()
    encolarAccion(USUARIO, noEntrega())
    expect(oyente).toHaveBeenCalledTimes(1)
  })

  it('ignora entradas guardadas ilegibles en vez de romper', () => {
    expect(leerCola(undefined)).toEqual([])
  })
})

describe('envío de la cola de la consola', () => {
  it('manda en orden de llegada: la entrega a /entregar con su clave y el aviso a /reportar-parada; vacía la cola', async () => {
    encolarAccion(USUARIO, noEntrega(), 2000)
    encolarAccion(USUARIO, entrega(), 1000)
    mockPost.mockResolvedValue({})
    const alEnviar = jest.fn()
    expect(await enviarPendientesConsola(USUARIO, { alEnviar })).toBe('completa')
    expect(mockPost.mock.calls).toEqual([
      ['/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar', { claveIdempotencia: 'k-1', nombreReceptor: 'Marta' }],
      ['/api/v1/Logistica/hojas-ruta/h1/reportar-parada', { entregado: false, motivoRechazo: 'Cerrado', hojaDeRutaId: 'h1', paradaId: 'p2' }],
    ])
    expect(leerCola(USUARIO)).toEqual([])
    expect(alEnviar).toHaveBeenCalledWith('h1')
  })

  it('sin cola devuelve vacia y no llama a nadie', async () => {
    expect(await enviarPendientesConsola(USUARIO)).toBe('vacia')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('si la señal se corta (sin red, 5xx) deja todo como estaba, cuenta el intento y corta la ronda', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed'))
    expect(await enviarPendientesConsola(USUARIO)).toBe('sinSenal')
    expect(mockPost).toHaveBeenCalledTimes(1)
    const [a, b] = leerCola(USUARIO)
    expect(a.estado).toEqual({ tipo: 'esperando', intentos: 1 })
    expect(b.estado).toEqual({ tipo: 'esperando', intentos: 0 })
    mockPost.mockRejectedValueOnce(rechazo(503, 'caído'))
    expect(await enviarPendientesConsola(USUARIO)).toBe('sinSenal')
    expect(leerCola(USUARIO)[0].estado).toEqual({ tipo: 'esperando', intentos: 2 })
  })

  it('el reintento repite la misma clave y el mismo cuerpo', async () => {
    encolarAccion(USUARIO, entrega())
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed'))
    await enviarPendientesConsola(USUARIO)
    mockPost.mockResolvedValue({})
    await enviarPendientesConsola(USUARIO)
    expect(mockPost.mock.calls[1]).toEqual(mockPost.mock.calls[0])
  })

  it('el aviso "No pude entregar" manda su claveIdempotencia y el reintento repite la misma', async () => {
    encolarAccion(USUARIO, noEntrega({ cuerpo: { entregado: false, motivoRechazo: 'Cerrado', claveIdempotencia: 'k-2' } } as never))
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed'))
    await enviarPendientesConsola(USUARIO)
    mockPost.mockResolvedValue({})
    await enviarPendientesConsola(USUARIO)
    expect(mockPost.mock.calls[0][1]).toEqual(expect.objectContaining({ claveIdempotencia: 'k-2' }))
    expect(mockPost.mock.calls[1]).toEqual(mockPost.mock.calls[0])
  })

  it('un aviso con clave ya usada con otro cuerpo (409) no cuenta como enviado ni se reintenta: queda para revisar', async () => {
    encolarAccion(USUARIO, noEntrega({ cuerpo: { entregado: false, claveIdempotencia: 'k-2' } } as never))
    mockPost.mockRejectedValueOnce(rechazo(409, 'Este reporte ya se había registrado con otros datos.', 'ClaveIdempotenciaConOtroCuerpo'))
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(leerCola(USUARIO)).toEqual([expect.objectContaining({ clave: 'k-2', estado: expect.objectContaining({ tipo: 'revisar' }) })])
    mockPost.mockClear()
    expect(await enviarPendientesConsola(USUARIO)).toBe('vacia')
  })

  it('"ya registrada" (409 de la clave o "ya fue reportada") cuenta como enviada', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    mockPost
      .mockRejectedValueOnce(rechazo(409, 'Esta entrega ya se había registrado antes con otros datos.', 'ClaveIdempotenciaConOtroCuerpo'))
      .mockRejectedValueOnce(rechazo(409, 'La parada ya fue reportada.'))
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('un rechazo del servidor (validación, clave de otra parada) no se reintenta: queda para revisar con su mensaje y la ronda sigue', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    mockPost
      .mockRejectedValueOnce(rechazo(400, 'Falta quién recibió.'))
      .mockResolvedValueOnce({})
    const alFallar = jest.fn()
    expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('completa')
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(leerCola(USUARIO)).toEqual([expect.objectContaining({ clave: 'k-1', estado: { tipo: 'revisar', mensaje: 'Falta quién recibió.' } })])
    expect(alFallar).toHaveBeenCalledWith(expect.objectContaining({ clave: 'k-1' }))
    // Las que esperan revisión no se vuelven a mandar solas.
    mockPost.mockClear()
    expect(await enviarPendientesConsola(USUARIO)).toBe('vacia')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('no manda nada si entró otro usuario en el teléfono', async () => {
    encolarAccion(USUARIO, entrega())
    expect(await enviarPendientesConsola(USUARIO, { sesion: () => 'otro' })).toBe('sinSenal')
    expect(mockPost).not.toHaveBeenCalled()
    expect(leerCola(USUARIO)[0].estado).toEqual({ tipo: 'esperando', intentos: 0 })
  })
})

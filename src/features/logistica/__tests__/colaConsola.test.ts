import { ApiError } from '@/core/api/client'
import { useAuthStore } from '@/features/auth/store/auth.store'
import {
  cambiarEstado, descartarAccion, encolarAccion, leerCola, quitarDeCola, reintentarAccion, suscribirCola, textoDeCola, type DatosAccion,
} from '../cola/colaConsola'
import { TOPE_DE_INTENTOS, avisoDeTope } from '@/core/utils/colasSinSenal'
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
      ['/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar', { claveIdempotencia: 'k-1', nombreReceptor: 'Marta', resueltaEn: new Date(1000).toISOString() }],
      ['/api/v1/Logistica/hojas-ruta/h1/reportar-parada', { entregado: false, motivoRechazo: 'Cerrado', hojaDeRutaId: 'h1', paradaId: 'p2', resueltaEn: new Date(2000).toISOString() }],
    ])
    expect(leerCola(USUARIO)).toEqual([])
    expect(alEnviar).toHaveBeenCalledWith('h1')
  })

  it('S6: una acción guardada con una hora imposible se manda sin resueltaEn en vez de romper', async () => {
    encolarAccion(USUARIO, entrega(), 8.64e15 + 1)
    mockPost.mockResolvedValue({})
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(mockPost.mock.calls[0][1]).toEqual({ claveIdempotencia: 'k-1', nombreReceptor: 'Marta' })
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
    expect(a.estado).toEqual({ tipo: 'esperando', intentos: 1, fallosDelTope: 0 })
    expect(b.estado).toEqual({ tipo: 'esperando', intentos: 0 })
    mockPost.mockRejectedValueOnce(rechazo(503, 'caído'))
    expect(await enviarPendientesConsola(USUARIO)).toBe('sinSenal')
    expect(leerCola(USUARIO)[0].estado).toEqual({ tipo: 'esperando', intentos: 2, fallosDelTope: 1 })
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

  it('RED-01: un tiempo agotado (AbortError) no la manda a revisar: sigue esperando, cuenta el intento y corta la ronda', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    mockPost.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
    expect(await enviarPendientesConsola(USUARIO)).toBe('sinSenal')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(leerCola(USUARIO).map((a) => a.estado)).toEqual([{ tipo: 'esperando', intentos: 1, fallosDelTope: 1 }, { tipo: 'esperando', intentos: 0 }])
  })

  it(`RED-05: al fallo número ${TOPE_DE_INTENTOS} deja de reintentarse sola, queda para revisar con el aviso y la ronda sigue con la próxima`, async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    cambiarEstado(USUARIO, 'k-1', { tipo: 'esperando', intentos: TOPE_DE_INTENTOS - 1, fallosDelTope: TOPE_DE_INTENTOS - 1 })
    mockPost.mockRejectedValueOnce(rechazo(503, 'Servicio no disponible')).mockResolvedValueOnce({})
    const alFallar = jest.fn()
    expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('completa')
    expect(mockPost.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar', '/api/v1/Logistica/hojas-ruta/h1/reportar-parada',
    ])
    expect(leerCola(USUARIO)).toEqual([expect.objectContaining({
      clave: 'k-1', estado: { tipo: 'revisar', mensaje: avisoDeTope('Tocá Reintentar para mandarla de nuevo o Descartar para sacarla del teléfono.') },
    })])
    expect(alFallar).toHaveBeenCalledWith(expect.objectContaining({ clave: 'k-1' }))
    mockPost.mockClear()
    expect(await enviarPendientesConsola(USUARIO)).toBe('vacia')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it.each([
    ['sin red', new TypeError('Network request failed')],
    ['con la sesión vencida (401)', rechazo(401, 'Sesión expirada')],
  ])(`RED-05: %s el tope no la detiene: sigue esperando y sale sola cuando vuelve la señal`, async (_caso, fallo) => {
    encolarAccion(USUARIO, entrega(), 1000)
    cambiarEstado(USUARIO, 'k-1', { tipo: 'esperando', intentos: TOPE_DE_INTENTOS - 1, fallosDelTope: TOPE_DE_INTENTOS - 1 })
    mockPost.mockRejectedValueOnce(fallo)
    const alFallar = jest.fn()
    expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('sinSenal')
    expect(leerCola(USUARIO).map((a) => a.estado)).toEqual([{ tipo: 'esperando', intentos: TOPE_DE_INTENTOS, fallosDelTope: TOPE_DE_INTENTOS - 1 }])
    expect(alFallar).not.toHaveBeenCalled()
    mockPost.mockResolvedValueOnce({})
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('Reintentar vuelve a esperar una acción para revisar, desde cero intentos, y la ronda la manda con la misma clave y el mismo cuerpo', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    mockPost.mockRejectedValueOnce(rechazo(400, 'Falta quién recibió.'))
    await enviarPendientesConsola(USUARIO)
    const primera = mockPost.mock.calls[0]
    reintentarAccion(USUARIO, 'k-1')
    expect(leerCola(USUARIO)[0].estado).toEqual({ tipo: 'esperando', intentos: 0 })
    mockPost.mockResolvedValueOnce({})
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(mockPost.mock.calls[1]).toEqual(primera)
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('una acción que vuelve a esperar mientras corre una ronda sale en esa misma ronda', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    cambiarEstado(USUARIO, 'k-1', { tipo: 'revisar', mensaje: 'x' })
    mockPost.mockImplementation(async (url: string) => {
      if (url.endsWith('/reportar-parada')) reintentarAccion(USUARIO, 'k-1')
      return {}
    })
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('Descartar saca del teléfono solo una acción para revisar y no llama al servidor; una que espera no se descarta', () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    cambiarEstado(USUARIO, 'k-1', { tipo: 'revisar', mensaje: 'x' })
    descartarAccion(USUARIO, 'k-1')
    descartarAccion(USUARIO, 'k-2')
    expect(leerCola(USUARIO).map((a) => a.clave)).toEqual(['k-2'])
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('no manda nada si entró otro usuario en el teléfono', async () => {
    encolarAccion(USUARIO, entrega())
    expect(await enviarPendientesConsola(USUARIO, { sesion: () => 'otro' })).toBe('sinSenal')
    expect(mockPost).not.toHaveBeenCalled()
    expect(leerCola(USUARIO)[0].estado).toEqual({ tipo: 'esperando', intentos: 0 })
  })
})

describe('tope de la consola: solo cuentan los fallos que llegaron al servidor o se colgaron (RED-05)', () => {
  const ENTREGAR = '/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar'

  it.each([
    ['un 503', rechazo(503, 'Servicio no disponible')],
    ['un tiempo agotado (AbortError)', new DOMException('Aborted', 'AbortError')],
  ])(`${TOPE_DE_INTENTOS - 1} rondas sin red y después %s no la detienen: sigue esperando y sale en la próxima ronda`, async (_caso, fallo) => {
    encolarAccion(USUARIO, entrega(), 1000)
    const alFallar = jest.fn()
    for (let i = 0; i < TOPE_DE_INTENTOS - 1; i++) {
      mockPost.mockRejectedValueOnce(new TypeError('Network request failed'))
      expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('sinSenal')
    }
    mockPost.mockRejectedValueOnce(fallo)
    expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('sinSenal')
    expect(leerCola(USUARIO).map((a) => a.estado)).toEqual([{ tipo: 'esperando', intentos: TOPE_DE_INTENTOS, fallosDelTope: 1 }])
    expect(alFallar).not.toHaveBeenCalled()
    mockPost.mockResolvedValueOnce({})
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(leerCola(USUARIO)).toEqual([])
  })

  it('una cola guardada por la versión anterior (muchos intentos, sin la cuenta del tope) no se detiene en su primer 5xx', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    cambiarEstado(USUARIO, 'k-1', { tipo: 'esperando', intentos: 50 })
    mockPost.mockRejectedValueOnce(rechazo(503, 'Servicio no disponible'))
    expect(await enviarPendientesConsola(USUARIO)).toBe('sinSenal')
    expect(leerCola(USUARIO).map((a) => a.estado)).toEqual([{ tipo: 'esperando', intentos: 51, fallosDelTope: 1 }])
  })

  it('Reintentar una acción que la ronda en curso ya detuvo por el tope la vuelve a mandar en esa ronda, una vez y con la misma clave', async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    cambiarEstado(USUARIO, 'k-1', { tipo: 'esperando', intentos: TOPE_DE_INTENTOS - 1, fallosDelTope: TOPE_DE_INTENTOS - 1 })
    mockPost
      .mockRejectedValueOnce(rechazo(503, 'Servicio no disponible'))
      .mockImplementationOnce(async () => { reintentarAccion(USUARIO, 'k-1'); return {} })
      .mockResolvedValue({})
    expect(await enviarPendientesConsola(USUARIO)).toBe('completa')
    expect(mockPost.mock.calls.map(([url]) => url)).toEqual([ENTREGAR, '/api/v1/Logistica/hojas-ruta/h1/reportar-parada', ENTREGAR])
    expect(mockPost.mock.calls[2]).toEqual(mockPost.mock.calls[0])
    expect(leerCola(USUARIO)).toEqual([])
  })
})

describe('tiempo agotado en la consola: es un corte, no un rechazo (RED-01)', () => {
  const plazoVencido = () => new DOMException('Aborted', 'AbortError')
  // Las paradas de cobro, armadas sobre la misma hoja que la entrega.
  const deCobro = (o: Partial<DatosAccion>) => entrega(o)

  it.each<[string, DatosAccion, string]>([
    ['la entrega', entrega(), '/api/v1/Logistica/hojas-ruta/h1/paradas/p1/entregar'],
    ['el aviso "No pude entregar"', noEntrega({ cuerpo: { entregado: false, motivoRechazo: 'Cerrado', claveIdempotencia: 'k-2' } } as never), '/api/v1/Logistica/hojas-ruta/h1/reportar-parada'],
    ['el cobro de una parada de cobro', deCobro({
      tipo: 'cobroParada', clave: 'k-cobro', paradaId: 'pc1', cuerpo: { claveIdempotencia: 'k-cobro', lineas: [{ medioPagoId: 'm1', monto: 85000 }] }, cobrado: 85000,
    } as never), '/api/v1/Logistica/hojas-ruta/h1/paradas-cobro/pc1/cobrar'],
    ['el "No cobré"', deCobro({ tipo: 'noCobroParada', clave: 'no-cobrada:pc2', paradaId: 'pc2', cuerpo: { motivo: 'NoPago' } } as never),
      '/api/v1/Logistica/hojas-ruta/h1/paradas-cobro/pc2/no-cobrada'],
  ])('%s: sigue esperando, la ronda da sinSenal, no va a revisar y la próxima ronda la repite con la misma clave y el mismo cuerpo', async (_caso, accion, url) => {
    encolarAccion(USUARIO, accion, 1000)
    const alFallar = jest.fn()
    mockPost.mockRejectedValueOnce(plazoVencido())
    expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('sinSenal')
    expect(leerCola(USUARIO).map((a) => a.estado)).toEqual([{ tipo: 'esperando', intentos: 1, fallosDelTope: 1 }])
    expect(alFallar).not.toHaveBeenCalled()

    mockPost.mockResolvedValueOnce({})
    expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('completa')
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost.mock.calls[0][0]).toBe(url)
    expect(mockPost.mock.calls[1]).toEqual(mockPost.mock.calls[0])
    expect(leerCola(USUARIO)).toEqual([])
    expect(alFallar).not.toHaveBeenCalled()
  })

  it(`un tiempo agotado cuenta para el tope: el fallo número ${TOPE_DE_INTENTOS} por plazo la deja para revisar con el aviso y la ronda sigue`, async () => {
    encolarAccion(USUARIO, entrega(), 1000)
    encolarAccion(USUARIO, noEntrega(), 2000)
    cambiarEstado(USUARIO, 'k-1', { tipo: 'esperando', intentos: TOPE_DE_INTENTOS - 1, fallosDelTope: TOPE_DE_INTENTOS - 1 })
    mockPost.mockRejectedValueOnce(plazoVencido()).mockResolvedValueOnce({})
    const alFallar = jest.fn()
    expect(await enviarPendientesConsola(USUARIO, { alFallar })).toBe('completa')
    expect(leerCola(USUARIO)).toEqual([expect.objectContaining({
      clave: 'k-1', estado: { tipo: 'revisar', mensaje: avisoDeTope('Tocá Reintentar para mandarla de nuevo o Descartar para sacarla del teléfono.') },
    })])
    expect(alFallar).toHaveBeenCalledWith(expect.objectContaining({ clave: 'k-1' }))
  })
})

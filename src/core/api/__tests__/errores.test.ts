import { ApiError, leerError } from '@/core/api/client'
import { esError, esFallaDeRed, mensajeDeError, totalCambiadoDe } from '@/core/api/errores'

jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

// ProblemDetails del sobre único de error (C-007, api-contract «Sobre único de error»).
const PROBLEMA = {
  type: 'about:blank', title: 'Falta stock', status: 400, detail: 'Hay líneas sin stock: pedí una justificación.',
  instance: '/api/v1/Ventas', codigo: 'VentaMostradorSinStock', traceId: 't1',
  message: 'Hay líneas sin stock: pedí una justificación.',
  errors: { motivoSinStock: ['La justificación es obligatoria.'], general: ['Revisá el pedido.'] },
}

describe('leerError: único lector de cuerpos de error', () => {
  it('lee codigo, detail y errors (diccionario) del ProblemDetails', () => {
    const e = leerError({ ...PROBLEMA, message: undefined }, 400)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({
      status: 400,
      codigo: 'VentaMostradorSinStock',
      message: 'Hay líneas sin stock: pedí una justificación.',
      errors: ['La justificación es obligatoria.', 'Revisá el pedido.'],
    })
  })

  it('un código que el catálogo no conoce queda como Desconocido; sin código queda vacío', () => {
    expect(leerError({ ...PROBLEMA, codigo: 'CodigoDeUnBackendMasNuevo' }, 400).codigo).toBe('Desconocido')
    expect(leerError({ message: 'x' }, 400).codigo).toBeUndefined()
  })

  it('el sobre viejo (message, errors como lista) se lee igual que hasta ahora', () => {
    const e = leerError({ succeeded: false, message: 'La clave ya existe.', errors: ['detalle'], data: { a: 1 } }, 409)
    expect(e).toMatchObject({ status: 409, message: 'La clave ya existe.', errors: ['detalle'], data: { a: 1 } })
  })

  it('un 5xx nunca muestra el texto del servidor; un cuerpo que no es objeto da el mensaje del status', () => {
    expect(leerError({ detail: 'System.NullReferenceException en ...' }, 500).message).toBe('Error interno del servidor. Intentá más tarde.')
    expect(leerError('<html>502</html>', 502).message).toBe('El servidor no está disponible.')
  })
})

describe('esError: decide por código, no por texto', () => {
  it('true solo para un ApiError con ese código', () => {
    const e = leerError(PROBLEMA, 400)
    expect(esError(e, 'VentaMostradorSinStock')).toBe(true)
    expect(esError(e, 'Duplicado')).toBe(false)
    expect(esError(new Error('Hay líneas sin stock'), 'VentaMostradorSinStock')).toBe(false)
    expect(esError(null, 'Duplicado')).toBe(false)
  })
})

describe('esFallaDeRed: el pedido no llegó al servidor', () => {
  it('reconoce el TypeError de fetch de React Native, no un bug cualquiera ni un ApiError', () => {
    expect(esFallaDeRed(new TypeError('Network request failed'))).toBe(true)
    expect(esFallaDeRed(new TypeError('x is not a function'))).toBe(false)
    expect(esFallaDeRed(new ApiError(500, 'boom'))).toBe(false)
  })
})

describe('mensajeDeError: el texto que ve el usuario', () => {
  it('une el mensaje y los errores por campo; mismo texto que antes para el sobre viejo', () => {
    expect(mensajeDeError(leerError(PROBLEMA, 400))).toBe(
      'Hay líneas sin stock: pedí una justificación.\nLa justificación es obligatoria.\nRevisá el pedido.',
    )
    expect(mensajeDeError(leerError({ message: 'Datos malos', errors: ['uno', 'dos'] }, 400))).toBe('Datos malos\nuno\ndos')
  })

  it('cualquier cosa que no sea un Error cae al texto por defecto', () => {
    expect(mensajeDeError('texto suelto', 'No se pudo.')).toBe('No se pudo.')
    expect(mensajeDeError(undefined)).toBe('No se pudo completar la operación.')
    expect(mensajeDeError(new Error('falló algo'))).toBe('falló algo')
  })
})

describe('mensajeDeError: fallas de red y tiempo agotado', () => {
  it('traduce el TypeError de red de fetch', () => {
    expect(mensajeDeError(new TypeError('Network request failed'))).toBe('Sin conexión. Revisá tu red e intentá de nuevo.')
  })

  it('traduce el AbortError que tira fetchWithTimeout al vencer el plazo', () => {
    const abort = new Error('Aborted')
    abort.name = 'AbortError'
    expect(mensajeDeError(abort)).toBe('La conexión tardó demasiado. Intentá de nuevo.')
    expect(mensajeDeError(new DOMException('Aborted', 'AbortError'))).toBe('La conexión tardó demasiado. Intentá de nuevo.')
  })

  it('un error que no es de red conserva su texto de antes', () => {
    expect(mensajeDeError(new ApiError(409, 'La clave ya existe.'))).toBe('La clave ya existe.')
    expect(mensajeDeError(new Error('otro'))).toBe('otro')
    expect(mensajeDeError(new TypeError('x is not a function'))).toBe('x is not a function')
  })
})

describe('totalCambiadoDe: el 409 TotalCambiado de POST /Ventas', () => {
  const data = { total: 121, lineas: [{ productoId: 'p1', precioBase: 100 }] }
  it('con el código del catálogo da el total de hoy', () => {
    expect(totalCambiadoDe(new ApiError(409, 'x', undefined, 'TotalCambiado', data))).toEqual({ total: 121 })
  })
  it('con el código sin catalogar (Desconocido) se reconoce por la forma de data', () => {
    expect(totalCambiadoDe(new ApiError(409, 'x', undefined, 'Desconocido', data))).toEqual({ total: 121 })
    expect(totalCambiadoDe(new ApiError(409, 'x', undefined, 'Desconocido', { total: 5 }))).toBeNull()
  })
  it('sin total en data devuelve null en el total; otro 409 o otro status no es este error', () => {
    expect(totalCambiadoDe(new ApiError(409, 'x', undefined, 'TotalCambiado', {}))).toEqual({ total: null })
    expect(totalCambiadoDe(new ApiError(409, 'x', undefined, 'Duplicado', data))).toBeNull()
    expect(totalCambiadoDe(new ApiError(400, 'x', undefined, 'TotalCambiado', data))).toBeNull()
    expect(totalCambiadoDe(new Error('x'))).toBeNull()
  })
})

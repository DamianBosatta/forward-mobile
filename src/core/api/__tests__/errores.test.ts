import { ApiError, leerError } from '@/core/api/client'
import { esError, esFallaDeRed, mensajeDeError } from '@/core/api/errores'

jest.mock('@/core/query/persistConfig', () => ({ mmkvPersister: { removeClient: jest.fn() } }))

// ProblemDetails del sobre único de error (C-007, api-contract «Sobre único de error»).
const PROBLEMA = {
  type: 'about:blank', title: 'Falta stock', status: 400, detail: 'Hay líneas sin stock: pedí una justificación.',
  instance: '/api/v1/Ventas', codigo: 'VentaFaltaStockSinJustificacion', traceId: 't1',
  message: 'Hay líneas sin stock: pedí una justificación.',
  errors: { motivoSinStock: ['La justificación es obligatoria.'], general: ['Revisá el pedido.'] },
}

describe('leerError: único lector de cuerpos de error', () => {
  it('lee codigo, detail y errors (diccionario) del ProblemDetails', () => {
    const e = leerError({ ...PROBLEMA, message: undefined }, 400)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({
      status: 400,
      codigo: 'VentaFaltaStockSinJustificacion',
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
    expect(esError(e, 'VentaFaltaStockSinJustificacion')).toBe(true)
    expect(esError(e, 'Duplicado')).toBe(false)
    expect(esError(new Error('Hay líneas sin stock'), 'VentaFaltaStockSinJustificacion')).toBe(false)
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

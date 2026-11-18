import { ApiError } from '@/core/api/client'
import { detieneEnElTope, fallosDelTopeTras } from '../colasSinSenal'

describe('cuenta del tope de las colas sin señal (RED-05)', () => {
  it.each<[string, unknown, number]>([
    ['un tiempo agotado (AbortError) se colgó en el camino: suma', new DOMException('Aborted', 'AbortError'), 3],
    ['un 503 llegó al servidor: suma', new ApiError(503, 'Servicio no disponible', []), 3],
    ['sin red el pedido no salió: no suma', new TypeError('Network request failed'), 2],
    ['con la sesión vencida (401) no suma', new ApiError(401, 'Sesión expirada', []), 2],
  ])('%s', (_caso, fallo, esperado) => {
    expect(fallosDelTopeTras(2, fallo)).toBe(esperado)
    expect(detieneEnElTope(fallo)).toBe(esperado === 3)
  })
})

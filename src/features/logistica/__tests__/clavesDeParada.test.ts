import { storage } from '@/core/utils/storage'
import { claveDeParada, olvidarClaveDeParada } from '../cola/clavesDeParada'

let mockN = 0
jest.mock('@/core/utils/idempotencia', () => ({
  ...jest.requireActual('@/core/utils/idempotencia'),
  nuevaClaveIdempotencia: () => `clave-${++mockN}`,
}))

const DIA = 24 * 60 * 60_000

beforeEach(() => {
  mockN = 0
  storage.remove('consola-claves:u1')
  storage.remove('consola-claves:u2')
})

describe('stop idempotency keys kept in the phone (RED-08)', () => {
  it('the same use returns the same key until it is forgotten; then a new one comes out', () => {
    expect(claveDeParada('u1', 'cobro:pc1', 0)).toBe('clave-1')
    expect(claveDeParada('u1', 'cobro:pc1', 1000)).toBe('clave-1')
    expect(claveDeParada('u1', 'cobro:pc2', 1000)).toBe('clave-2')
    olvidarClaveDeParada('u1', 'cobro:pc1')
    expect(claveDeParada('u1', 'cobro:pc1', 2000)).toBe('clave-3')
    expect(claveDeParada('u1', 'cobro:pc2', 2000)).toBe('clave-2')
  })

  it('the key is stored before it is returned, so a new process (app killed and reopened) reads the same one', () => {
    const clave = claveDeParada('u1', 'entrega:p1', 0)
    expect(JSON.parse(storage.getString('consola-claves:u1') ?? '{}')).toEqual({ 'entrega:p1': { clave, en: 0 } })
  })

  it('each user has their own keys', () => {
    expect(claveDeParada('u1', 'cobro:pc1', 0)).toBe('clave-1')
    expect(claveDeParada('u2', 'cobro:pc1', 0)).toBe('clave-2')
  })

  it('a key older than 7 days is replaced and stale ones are cleaned when another is stored', () => {
    claveDeParada('u1', 'cobro:viejo', 0)
    expect(claveDeParada('u1', 'cobro:pc1', 8 * DIA)).toBe('clave-2')
    expect(JSON.parse(storage.getString('consola-claves:u1') ?? '{}')).toEqual({ 'cobro:pc1': { clave: 'clave-2', en: 8 * DIA } })
  })

  it('unreadable stored keys do not break: it starts from scratch', () => {
    storage.set('consola-claves:u1', 'no es json')
    expect(claveDeParada('u1', 'cobro:pc1', 0)).toBe('clave-1')
  })
})

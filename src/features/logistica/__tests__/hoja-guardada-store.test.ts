/**
 * MR-R6-01 (the saved sheet carries its day), REN-R6-2 (write only when it changed), ARQ-R6-1 (a version bump
 * must come with a migration).
 */
import { useHojaRutaGuardada, CLAVE_HOJA_GUARDADA, type ActiveHojaRuta } from '../store/hojaRutaGuardada.store'
import { zustandStorage } from '@/core/utils/storage'

jest.mock('@/core/utils/storage', () => {
  const memoria = new Map<string, string>()
  const almacen = {
    getItem: jest.fn((k: string) => memoria.get(k) ?? null),
    setItem: jest.fn((k: string, v: string) => { memoria.set(k, v) }),
    removeItem: jest.fn((k: string) => { memoria.delete(k) }),
  }
  return { ...jest.requireActual('@/core/utils/storage'), zustandStorage: almacen }
})

const HOJA = { id: 'h1', detalles: [{ id: 'p1', estado: 1 }] } as unknown as ActiveHojaRuta
const MEDIODIA = Date.UTC(2026, 10, 20, 15, 0, 0) // 12:00 in Argentina on 2026-11-20

describe('hojaRutaGuardada', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MEDIODIA)
    useHojaRutaGuardada.getState().borrar()
    ;(zustandStorage.setItem as jest.Mock).mockClear()
  })
  afterEach(() => jest.useRealTimers())

  it('stamps the saved sheet with the Argentine business day', () => {
    useHojaRutaGuardada.getState().guardar(HOJA)
    expect(useHojaRutaGuardada.getState().guardadaEl).toBe('2026-11-20')
  })

  it('does not write again when the same sheet is saved the same day', () => {
    useHojaRutaGuardada.getState().guardar(HOJA)
    const escrituras = (zustandStorage.setItem as jest.Mock).mock.calls.length
    useHojaRutaGuardada.getState().guardar({ ...HOJA, detalles: [{ id: 'p1', estado: 1 }] } as unknown as ActiveHojaRuta)
    expect((zustandStorage.setItem as jest.Mock).mock.calls.length).toBe(escrituras)
  })

  it('writes when the sheet changed, and when the same sheet arrives on another day', () => {
    useHojaRutaGuardada.getState().guardar(HOJA)
    const antes = (zustandStorage.setItem as jest.Mock).mock.calls.length
    useHojaRutaGuardada.getState().guardar({ ...HOJA, detalles: [{ id: 'p1', estado: 2 }] } as unknown as ActiveHojaRuta)
    expect((zustandStorage.setItem as jest.Mock).mock.calls.length).toBe(antes + 1)
    jest.setSystemTime(MEDIODIA + 24 * 3_600_000)
    useHojaRutaGuardada.getState().guardar({ ...HOJA, detalles: [{ id: 'p1', estado: 2 }] } as unknown as ActiveHojaRuta)
    expect((zustandStorage.setItem as jest.Mock).mock.calls.length).toBe(antes + 2)
    expect(useHojaRutaGuardada.getState().guardadaEl).toBe('2026-11-21')
  })

  it('borrar clears the sheet and its day', () => {
    useHojaRutaGuardada.getState().guardar(HOJA)
    useHojaRutaGuardada.getState().borrar()
    expect(useHojaRutaGuardada.getState()).toMatchObject({ hoja: null, guardadaEl: null })
  })

  it('persist version 1: raising it needs a migration that carries the trip over (ARQ-R6-1)', () => {
    const opciones = useHojaRutaGuardada.persist.getOptions()
    expect(opciones.name).toBe(CLAVE_HOJA_GUARDADA)
    // If this fails you raised the version: replace `migrate` (which drops the trip) with one that keeps `hoja`, then update this.
    expect(opciones.version).toBe(1)
  })
})

/**
 * Tests unitarios del CajaStore.
 * Verifica las mutaciones de estado sin persistencia real.
 */

import { act } from '@testing-library/react-native'
import { useCajaStore } from '@/libs/store/caja.store'

// Reset store entre cada test para evitar contaminación
beforeEach(() => {
  act(() => {
    useCajaStore.setState({ cajaActiva: null, isLoading: false })
  })
})

const buildCaja = (overrides = {}) => ({
  id: 'caja-001',
  fecha: '2026-05-30',
  usuarioAperturaId: 'user-1',
  usuarioApertura: 'Admin Test',
  saldoInicial: 5000,
  estado: 'Abierta' as const,
  ...overrides,
})

describe('useCajaStore', () => {
  it('estado inicial: cajaActiva es null e isLoading es false', () => {
    const { cajaActiva, isLoading } = useCajaStore.getState()
    expect(cajaActiva).toBeNull()
    expect(isLoading).toBe(false)
  })

  it('setCajaActiva almacena la caja correctamente', () => {
    const caja = buildCaja()
    act(() => {
      useCajaStore.getState().setCajaActiva(caja)
    })
    const { cajaActiva } = useCajaStore.getState()
    expect(cajaActiva).not.toBeNull()
    expect(cajaActiva?.id).toBe('caja-001')
    expect(cajaActiva?.estado).toBe('Abierta')
    expect(cajaActiva?.saldoInicial).toBe(5000)
  })

  it('setCajaActiva con null limpia la caja activa', () => {
    act(() => {
      useCajaStore.getState().setCajaActiva(buildCaja())
    })
    expect(useCajaStore.getState().cajaActiva).not.toBeNull()

    act(() => {
      useCajaStore.getState().setCajaActiva(null)
    })
    expect(useCajaStore.getState().cajaActiva).toBeNull()
  })

  it('setLoading actualiza isLoading', () => {
    act(() => {
      useCajaStore.getState().setLoading(true)
    })
    expect(useCajaStore.getState().isLoading).toBe(true)

    act(() => {
      useCajaStore.getState().setLoading(false)
    })
    expect(useCajaStore.getState().isLoading).toBe(false)
  })

  it('almacena caja cerrada con saldos de cierre', () => {
    const cajaCerrada = buildCaja({
      estado: 'Cerrada',
      fechaCierre: '2026-05-30T18:00:00Z',
      saldoFinalDeclarado: 12000,
      saldoFinalSistema: 11800,
      diferencia: 200,
    })

    act(() => {
      useCajaStore.getState().setCajaActiva(cajaCerrada)
    })

    const { cajaActiva } = useCajaStore.getState()
    expect(cajaActiva?.estado).toBe('Cerrada')
    expect(cajaActiva?.diferencia).toBe(200)
    expect(cajaActiva?.saldoFinalDeclarado).toBe(12000)
  })
})

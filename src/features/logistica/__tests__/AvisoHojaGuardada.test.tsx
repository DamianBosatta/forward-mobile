/**
 * Decisión del dueño (MR-R6-01): sin conexión, la hoja guardada de otro día se sigue mostrando, pero con su fecha.
 */
import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { conTema, TEMAS } from '@/core/ui/fw/__testing__/tema'
import { diaArgentina } from '@/core/utils/fecha'
import { AvisoHojaGuardada } from '../components/AvisoHojaGuardada'

const AHORA = Date.parse('2026-11-21T15:00:00Z')
const HOY = diaArgentina(AHORA)
const AYER = diaArgentina(AHORA - 24 * 60 * 60_000)

describe.each(TEMAS)('AvisoHojaGuardada (%s)', (tema) => {
  beforeEach(() => { conTema(tema); jest.spyOn(Date, 'now').mockReturnValue(AHORA) })
  afterEach(() => jest.restoreAllMocks())

  it('offline with a sheet saved yesterday: shows the date as dd/mm/aaaa', () => {
    render(<AvisoHojaGuardada enLinea={false} guardadaEl={AYER} />)
    expect(screen.getByText(/Hoja del 20\/11\/2026, sin conexión/)).toBeTruthy()
  })

  it('offline with a sheet saved today: shows nothing', () => {
    render(<AvisoHojaGuardada enLinea={false} guardadaEl={HOY} />)
    expect(screen.queryByText(/sin conexión/)).toBeNull()
  })

  it('online: shows nothing even if the saved sheet is old', () => {
    render(<AvisoHojaGuardada enLinea guardadaEl={AYER} />)
    expect(screen.queryByText(/sin conexión/)).toBeNull()
  })

  it('a copy saved before the date existed (null): shows nothing', () => {
    render(<AvisoHojaGuardada enLinea={false} guardadaEl={null} />)
    expect(screen.queryByText(/sin conexión/)).toBeNull()
  })
})

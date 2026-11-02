import { AppState, type AppStateStatus } from 'react-native'
import { focusManager, QueryObserver } from '@tanstack/react-query'
import { crearQueryClient } from '../queryClient'

describe('focusManager follows AppState', () => {
  let emitir: (estado: AppStateStatus) => void
  let addSpy: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    addSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, oyente) => {
      emitir = oyente as (estado: AppStateStatus) => void
      return { remove: jest.fn() }
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    addSpy.mockRestore()
    focusManager.setEventListener(() => () => {})
    focusManager.setFocused(undefined)
  })

  it('is unfocused in background and a refetchInterval query stops polling; back to active it polls again', async () => {
    const qc = crearQueryClient({ retry: false })
    const queryFn = jest.fn().mockResolvedValue('ok')
    const baja = new QueryObserver(qc, { queryKey: ['poll'], queryFn, refetchInterval: 1_000 }).subscribe(() => {})
    await jest.advanceTimersByTimeAsync(0)
    const inicial = queryFn.mock.calls.length

    emitir('background')
    expect(focusManager.isFocused()).toBe(false)
    await jest.advanceTimersByTimeAsync(5_000)
    expect(queryFn).toHaveBeenCalledTimes(inicial)

    emitir('active')
    expect(focusManager.isFocused()).toBe(true)
    await jest.advanceTimersByTimeAsync(2_500)
    expect(queryFn.mock.calls.length).toBeGreaterThan(inicial)
    baja()
  })
})

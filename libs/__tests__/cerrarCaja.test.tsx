import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCerrarCaja } from '@/libs/api-client/finanzas'
import { api } from '@/libs/api-client/client'

jest.mock('@/libs/api-client/client', () => ({ api: { post: jest.fn().mockResolvedValue({ cajaId: 'k1' }) } }))

it('cerrar caja usa la ruta vigente, con la caja en el cuerpo', async () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const { result } = renderHook(() => useCerrarCaja(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })

  await act(() => result.current.mutateAsync({ cajaId: 'k1', saldoFinalDeclarado: 1500 }))

  expect(api.post).toHaveBeenCalledWith('/api/v1/Cajas/cerrar', { cajaId: 'k1', saldoFinalDeclarado: 1500 })
})

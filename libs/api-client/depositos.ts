import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { Deposito, CreateDepositoRequest, UpdateDepositoRequest, DeactivateDepositoRequest } from './types'
import { invalidarDepositos, invalidarDepositosYStock } from './invalidaciones'

export const depositosKeys = {
  all: ['depositos'] as const,
  lists: () => [...depositosKeys.all, 'list'] as const,
}

export function useDepositos() {
  return useQuery({
    queryKey: depositosKeys.lists(),
    queryFn: () => api.get<Deposito[]>('/api/v1/Depositos'),
    staleTime: 10 * 60_000,
  })
}


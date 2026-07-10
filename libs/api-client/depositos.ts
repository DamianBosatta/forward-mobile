import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Deposito, CreateDepositoRequest, UpdateDepositoRequest, DeactivateDepositoRequest } from './types'

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

export function useCreateDeposito() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDepositoRequest) => api.post<string>('/api/v1/Depositos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: depositosKeys.all }),
  })
}

export function useUpdateDeposito() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateDepositoRequest) => api.put<string>(`/api/v1/Depositos/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: depositosKeys.all })
    },
  })
}

export function useDeactivateDeposito() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: DeactivateDepositoRequest) => {
      const url = `/api/v1/Depositos/${params.id}${params.targetDepositoId ? `?targetId=${params.targetDepositoId}` : ''}`
      return api.delete<boolean>(url)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: depositosKeys.all })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

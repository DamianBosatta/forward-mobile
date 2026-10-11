import { useAuthStore } from '@/features/auth/store/auth.store'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'

/** Depósito de la disponibilidad: el del usuario si el perfil lo trae; si no, el Central (BACKLOG-9B.md). */
export function useDepositoDeConsulta(): string {
  return useAuthStore((s) => s.user?.depositoId) ?? DEPOSITO_CENTRAL_ID
}

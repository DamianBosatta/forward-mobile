import { useDepositoParaRegistrar } from '@/features/deposito-sesion/hooks/useDepositoDeSesion'

/**
 * Depósito de la disponibilidad y de lo que se registra (venta, compra, ficha, stock en vivo): el depósito de la
 * sesión (S8). Quien ve todos los depósitos lo elige en Inicio ("Todos" consulta en el Central); el resto, siempre el
 * suyo; sin depósito en el perfil, el Central (BACKLOG-9B.md).
 */
export function useDepositoDeConsulta(): string {
  return useDepositoParaRegistrar()
}

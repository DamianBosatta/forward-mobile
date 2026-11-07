import { create } from 'zustand'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useDepositoDeConsulta } from '@/features/catalogo/hooks/useDepositoDeConsulta'

/**
 * Depósito elegido para la venta en curso (solo lo cambia quien tiene `CAP_VER_TODOS_LOS_DEPOSITOS`). `null` = el
 * propio. Se vacía al abrir y al cerrar la pantalla de venta: cada venta nueva arranca en el depósito del usuario.
 */
export const useDepositoElegidoStore = create<{ elegido: string | null; elegir: (id: string | null) => void }>((set) => ({
  elegido: null,
  elegir: (id) => set({ elegido: id }),
}))

/** ¿Elige el depósito de la venta y de la compra? Por capacidad, nunca por rol (X3). */
export function usePuedeElegirDeposito(): boolean {
  return hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_TODOS_LOS_DEPOSITOS')
}

/**
 * LA fuente del depósito de la venta: stock, disponibilidad, variantes, borrador, vista previa y confirmación leen
 * de acá, para que nunca discrepen. Sin elección es el del usuario; sin depósito en el perfil, el Central
 * (`useDepositoDeConsulta`). Una venta que se retoma, edita o duplica trae el suyo (aunque no pueda elegir): lo
 * guardado manda. Quien elige es solo quien tiene la capacidad (`SelectorDepositoVenta`).
 */
export function useDepositoDeVenta(): string {
  const propio = useDepositoDeConsulta()
  const elegido = useDepositoElegidoStore((s) => s.elegido)
  return elegido ?? propio
}

/**
 * El depósito de la venta solo si NO es el propio; `undefined` si es el propio. El catálogo del propio sigue con su
 * clave y su URL de siempre (también la que se guarda para abrir sin señal); otro depósito lleva `depositoId`.
 */
export function useDepositoAjenoDeVenta(): string | undefined {
  const propio = useDepositoDeConsulta()
  const deVenta = useDepositoDeVenta()
  return deVenta === propio ? undefined : deVenta
}

import { create } from 'zustand'
import { useDepositoDeConsulta } from '@/features/catalogo/hooks/useDepositoDeConsulta'
import { useDepositoPropio, usePuedeElegirDeposito } from '@/features/deposito-sesion/hooks/useDepositoDeSesion'

/**
 * Depósito elegido para la venta en curso (solo lo cambia quien tiene `CAP_VER_TODOS_LOS_DEPOSITOS`). `null` = el de
 * la sesión. Se vacía al abrir y al cerrar la pantalla de venta: cada venta nueva arranca en el depósito de la sesión.
 * Cambiar el depósito de la sesión no toca esta elección (una venta abierta sigue en el suyo).
 */
export const useDepositoElegidoStore = create<{ elegido: string | null; elegir: (id: string | null) => void }>((set) => ({
  elegido: null,
  elegir: (id) => set({ elegido: id }),
}))

/** ¿Elige el depósito de la venta y de la compra? La misma regla que el depósito de la sesión (X3). */
export { usePuedeElegirDeposito }

/**
 * LA fuente del depósito de la venta: stock, disponibilidad, variantes, borrador, vista previa y confirmación leen
 * de acá, para que nunca discrepen. Sin elección es el de la sesión (S8: el elegido en Inicio por quien ve todos;
 * para el resto, el del usuario; sin depósito en el perfil, el Central: `useDepositoDeConsulta`). Una venta que se retoma, edita o duplica trae el suyo (aunque no pueda elegir): lo
 * guardado manda. Quien elige es solo quien tiene la capacidad (`SelectorDepositoVenta`).
 */
export function useDepositoDeVenta(): string {
  const propio = useDepositoDeConsulta()
  const elegido = useDepositoElegidoStore((s) => s.elegido)
  return elegido ?? propio
}

/**
 * El depósito de la venta solo si NO es el propio del usuario; `undefined` si es el propio. El catálogo del propio
 * sigue con su clave y su URL de siempre (también la que se guarda para abrir sin señal); otro depósito, también el de
 * la sesión, lleva `depositoId`: sin él el servidor contesta con el del usuario.
 */
export function useDepositoAjenoDeVenta(): string | undefined {
  const propio = useDepositoPropio()
  const deVenta = useDepositoDeVenta()
  return deVenta === propio ? undefined : deVenta
}

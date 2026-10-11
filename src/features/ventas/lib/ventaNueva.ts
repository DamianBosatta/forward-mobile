import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { logger } from '@/core/utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Switch de la venta nueva (Bloque 9A, PR 2.0)
//
// La venta con el formato nuevo convive con la vieja hasta que el dueño la apruebe.
// El switch es local al teléfono (SecureStore, como el modo de tema) y arranca APAGADO.
// Solo quien administra lo ve en "Mi cuenta" y solo para él tiene efecto: si en el mismo
// teléfono entra después un vendedor, ve la venta de hoy (no puede apagar un switch que
// no ve).
// ─────────────────────────────────────────────────────────────────────────────

export const VENTA_NUEVA_KEY = 'forward_venta_nueva'

interface VentaNuevaState {
  activa: boolean
  isHydrated: boolean
  setActiva: (activa: boolean) => Promise<void>
  hydrate: () => Promise<void>
}

export const useVentaNuevaStore = create<VentaNuevaState>((set) => ({
  activa: false,
  isHydrated: false,

  setActiva: async (activa) => {
    set({ activa })
    try {
      await SecureStore.setItemAsync(VENTA_NUEVA_KEY, activa ? '1' : '0')
    } catch (err) {
      // Vale en esta sesión aunque no se pueda guardar.
      logger.warn('No se pudo guardar el switch de la venta nueva', err)
    }
  },

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(VENTA_NUEVA_KEY)
      set({ activa: stored === '1', isHydrated: true })
    } catch {
      set({ isHydrated: true })
    }
  },
}))

/** ¿Este usuario puede ver y usar el switch? Administración (perfil Administrador o de sistemas). */
export function usePuedeProbarVentaNueva(): boolean {
  return useAuthStore((s) => s.isAdmin())
}

/** Lo consultan las pantallas: true solo con el switch prendido Y un usuario que puede probarla. */
export function useVentaNueva(): boolean {
  const activa = useVentaNuevaStore((s) => s.activa)
  const puede = usePuedeProbarVentaNueva()
  return activa && puede
}

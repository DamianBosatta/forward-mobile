import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { zustandStorage } from '@/core/utils/storage'
import { diaArgentina } from '@/core/utils/fecha'
import type { HojaRutaDetalleDto, ParadaDto } from '@/libs/api-client/types'
import { EstadoParada } from '@/libs/api-client/types'

// Local extension of ParadaDto with the delivery state the driver console writes for optimistic UI updates.
type ParadaConEstado = ParadaDto & {
  motivoRechazo?: string | null
  observaciones?: string | null
}

export type ActiveHojaRuta = Omit<HojaRutaDetalleDto, 'detalles'> & {
  detalles?: ParadaConEstado[] | null
}

/** Key of the dedicated persistence. Not the react-query cache: no buster, no maxAge (ARQ-05, S4). */
export const CLAVE_HOJA_GUARDADA = 'forward-hoja-ruta-guardada'
/**
 * Shape of what is saved. A different version is discarded on read (`migrate`), never read as this shape.
 * Raising it requires a real migration (carry `hoja` over): the default `migrate` drops the trip, and a driver mid-trip
 * without signal would lose it (ARQ-R6-1). `hoja-guardada-store.test.ts` fails on a bump until that is decided.
 */
const VERSION_HOJA_GUARDADA = 1

interface HojaGuardadaState {
  /** The open trip (stops, clients, addresses) kept on the phone so the console works offline after any restart or OTA. */
  hoja: ActiveHojaRuta | null
  /**
   * Business day (Argentina, X9) when `hoja` was last confirmed by the server; `null` in a copy saved before this field.
   * Not used to discard the sheet: that conflicts with ARQ-05/S4 (it must survive a restart a day later without signal) and needs the owner (MR-R6-01).
   */
  guardadaEl: string | null
  guardar: (hoja: ActiveHojaRuta) => void
  borrar: () => void
  updateStopStatus: (paradaId: string, payload: { delivered: boolean; observations?: string; reason?: string }) => void
}

/**
 * The saved trip of the driver console. It is its own persisted store, so it expires only when the trip is closed
 * (`borrar`, called when the trip ends, on "Cambiar de ruta" and on logout), not with time or with an OTA like the
 * query cache. Same encrypted MMKV as the rest of the app (SEG-10: stops, clients and addresses are never plain).
 */
export const useHojaRutaGuardada = create<HojaGuardadaState>()(
  persist(
    immer((set, get) => ({
      hoja: null,
      guardadaEl: null,
      guardar: (hoja) => {
        const hoy = diaArgentina(Date.now())
        const actual = get()
        // The console re-fetches every 30 s: an identical sheet must not re-encrypt and rewrite the whole trip (REN-R6-2).
        if (actual.guardadaEl === hoy && JSON.stringify(actual.hoja) === JSON.stringify(hoja)) return
        set((state) => { state.hoja = hoja; state.guardadaEl = hoy })
      },
      borrar: () => set((state) => { state.hoja = null; state.guardadaEl = null }),
      updateStopStatus: (paradaId, payload) => set((state) => {
        const parada = state.hoja?.detalles?.find((d) => d.id === paradaId)
        if (!parada) return
        parada.estado = payload.delivered ? EstadoParada.Entregado : EstadoParada.NoEntregado
        parada.motivoRechazo = payload.reason ?? ''
        if (payload.observations !== undefined) parada.observaciones = payload.observations
      }),
    })),
    {
      name: CLAVE_HOJA_GUARDADA,
      version: VERSION_HOJA_GUARDADA,
      // Any other version is a shape this build does not know: dropped, the console asks the server again.
      migrate: () => ({ hoja: null, guardadaEl: null }),
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ hoja: state.hoja, guardadaEl: state.guardadaEl }),
    },
  ),
)

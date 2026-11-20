import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { immer } from 'zustand/middleware/immer';
import { zustandStorageMudadoDesde } from '@/core/utils/storage';

import { useHojaRutaGuardada, type ActiveHojaRuta } from './hojaRutaGuardada.store';

/**
 * Client-only pointer of the driver console: which trip is open. The trip itself (stops, clients, addresses) is in
 * `useHojaRutaGuardada`, its own persistence (ARQ-05, S4).
 */
interface LogisticaState {
  activeTripId: string | null;

  setActiveTripId: (id: string | null) => void;
  /** The trip ended or was left: forgets the id and the saved copy. */
  clearActiveTrip: () => void;

  reset: () => void;
}

export const useLogisticaStore = create<LogisticaState>()(
  persist(
    immer((set) => ({
      activeTripId: null,

      setActiveTripId: (id) => set((state) => {
        state.activeTripId = id;
      }),

      clearActiveTrip: () => {
        useHojaRutaGuardada.getState().borrar();
        set((state) => { state.activeTripId = null; });
      },

      reset: () => {
        useHojaRutaGuardada.getState().borrar();
        set((state) => { state.activeTripId = null; });
      },
    })),
    {
      name: 'forward-logistica-store',
      version: 1,
      // v0 persisted the whole trip (`activeTrip`). Only its id stays here; the copy seeds the dedicated persistence,
      // so a driver mid-trip who gets this update keeps the trip offline.
      migrate: (persisted) => {
        const viejo = persisted as { activeTrip?: ActiveHojaRuta | null } | null;
        const viaje = viejo?.activeTrip ?? null;
        if (viaje) useHojaRutaGuardada.getState().guardar(viaje);
        return { activeTripId: viaje?.id ?? null };
      },
      // SEG-10: el viaje (paradas, clientes, direcciones) va cifrado; un viaje guardado por un build viejo en
      // AsyncStorage se muda en la primera lectura.
      storage: createJSONStorage(() => zustandStorageMudadoDesde(AsyncStorage)),
      partialize: (state) => ({
        activeTripId: state.activeTripId,
      }),
    }
  )
);


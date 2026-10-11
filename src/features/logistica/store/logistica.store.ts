import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { immer } from 'zustand/middleware/immer';
import type { HojaRutaDetalleDto, ParadaDto } from '@/libs/api-client/types';
import { EstadoHojaRuta, EstadoParada } from '@/libs/api-client/types';

// Local extension of ParadaDto that includes mutable delivery state written
// by the chofer consola. These fields are not persisted back to the server DTO
// but are kept in Zustand/AsyncStorage for optimistic UI updates.
type ParadaConEstado = ParadaDto & {
  motivoRechazo?: string | null;
  observaciones?: string | null;
};

// ActiveTrip uses ParadaConEstado[] for detalles (adds local delivery state fields).
type ActiveHojaRuta = Omit<HojaRutaDetalleDto, 'detalles'> & {
  detalles?: ParadaConEstado[] | null;
};

interface LogisticaState {
  // Viaje activo (Consola del Chofer)
  activeTrip: ActiveHojaRuta | null;

  setActiveTrip: (trip: ActiveHojaRuta | null) => void;
  clearActiveTrip: () => void;
  updateStopStatus: (paradaId: string, payload: { delivered: boolean; observations?: string; reason?: string }) => void;

  reset: () => void;
}

export const useLogisticaStore = create<LogisticaState>()(
  persist(
    immer((set) => ({
      activeTrip: null,

      // Actions Viaje
      setActiveTrip: (trip) => set((state) => {
        state.activeTrip = trip;
      }),
      
      clearActiveTrip: () => set((state) => {
        state.activeTrip = null;
      }),

      updateStopStatus: (paradaId, payload) => set((state) => {
        if (!state.activeTrip?.detalles) return;
        const index = state.activeTrip.detalles.findIndex(d => d.id === paradaId);
        if (index !== -1) {
          state.activeTrip.detalles[index].estado = payload.delivered ? EstadoParada.Entregado : EstadoParada.NoEntregado;
          state.activeTrip.detalles[index].motivoRechazo = payload.reason ?? '';
          if (payload.observations !== undefined) {
            state.activeTrip.detalles[index].observaciones = payload.observations;
          }
        }
      }),

      reset: () =>
        set((state) => {
          state.activeTrip = null;
        }),
    })),
    {
      name: 'forward-logistica-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeTrip: state.activeTrip,
      }),
    }
  )
);


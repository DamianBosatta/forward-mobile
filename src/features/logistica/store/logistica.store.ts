import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { immer } from 'zustand/middleware/immer';
import type { HojaRutaDetalleDto, ParadaDto } from '@/libs/api-client/types';
import { EstadoHojaRuta, EstadoParada } from '@/libs/api-client/types';
import { reorderStop, assignOrderNumbers } from '@/src/features/logistica/lib/viajes-logic';
import type { OrderedStop } from '@/src/features/logistica/lib/viajes-logic';

// Local extension of ParadaDto that includes mutable delivery state written
// by the chofer consola. These fields are not persisted back to the server DTO
// but are kept in Zustand/AsyncStorage for optimistic UI updates.
type ParadaConEstado = ParadaDto & {
  motivoRechazo?: string | null;
  observaciones?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Viaje Draft — ephemeral wizard state (NOT persisted in AsyncStorage)
// ─────────────────────────────────────────────────────────────────────────────

/** Step values for the Planificar Viaje wizard (1-indexed). */
export type WizardStep = 1 | 2 | 3 | 4;

/** Ephemeral draft for a trip being planned. Excluded from partialize(). */
export interface ViajeDraft {
  step: WizardStep;
  /** IDs of selected ventas empacadas → Record for O(1) toggle */
  selectedEmpacadaIds: Record<string, boolean>;
  choferId: string | null;
  vehiculoId: string | null;
  depositoId: string | null;
  /** ISO string so it serializes cleanly if ever needed elsewhere */
  fechaSalida: string;
  /** Ordered stop list returned by the server after POST hojas-ruta */
  orderedStops: OrderedStop[];
  /** Hoja de ruta ID returned by POST hojas-ruta (used to iniciar + share PDF) */
  hojaRutaId: string | null;
}

// ActiveTrip uses ParadaConEstado[] for detalles (adds local delivery state fields).
type ActiveHojaRuta = Omit<HojaRutaDetalleDto, 'detalles'> & {
  detalles?: ParadaConEstado[] | null;
};

interface LogisticaState {
  // IDs seleccionados (usamos Record para facilitar la persistencia en JSON)
  selectedConfirmadas: Record<string, boolean>;
  selectedEmpacadas: Record<string, boolean>;

  // Cantidad de bultos por venta
  bultosCounts: Record<string, number>;

  // Gestión de Viaje Activo (Consola del Chofer)
  activeTrip: ActiveHojaRuta | null;

  // Ephemeral wizard draft (NOT in partialize — not persisted)
  viajeDraft: ViajeDraft;

  // Actions
  toggleConfirmada: (id: string) => void;
  toggleEmpacada: (id: string) => void;
  removeConfirmada: (id: string) => void;
  selectAllConfirmadas: (ids: string[]) => void;
  selectAllEmpacadas: (ids: string[]) => void;
  clearConfirmadas: () => void;
  clearEmpacadas: () => void;

  setBultos: (id: string, count: number) => void;
  getBultos: (id: string) => number;

  // Actions Viaje
  setActiveTrip: (trip: ActiveHojaRuta | null) => void;
  clearActiveTrip: () => void;
  updateStopStatus: (paradaId: string, payload: { delivered: boolean; observations?: string; reason?: string }) => void;

  // Wizard draft actions
  setStep: (step: WizardStep) => void;
  toggleDraftEmpacada: (id: string) => void;
  setAssignment: (assignment: { choferId: string; vehiculoId: string; depositoId: string | null; fechaSalida: string }) => void;
  setOrderedStops: (stops: OrderedStop[], hojaRutaId: string) => void;
  moveStop: (index: number, direction: 'up' | 'down') => void;
  resetViajeDraft: () => void;

  reset: () => void;
}

// Initial state for the ephemeral wizard draft
const INITIAL_VIAJE_DRAFT: ViajeDraft = {
  step: 1,
  selectedEmpacadaIds: {},
  choferId: null,
  vehiculoId: null,
  depositoId: null,
  fechaSalida: new Date().toISOString(),
  orderedStops: [],
  hojaRutaId: null,
};

export const useLogisticaStore = create<LogisticaState>()(
  persist(
    immer((set, get) => ({
      selectedConfirmadas: {},
      selectedEmpacadas: {},
      bultosCounts: {},
      activeTrip: null,
      viajeDraft: { ...INITIAL_VIAJE_DRAFT },

      toggleConfirmada: (id) =>
        set((state) => {
          if (state.selectedConfirmadas[id]) {
            delete state.selectedConfirmadas[id];
          } else {
            state.selectedConfirmadas[id] = true;
          }
        }),

      toggleEmpacada: (id) =>
        set((state) => {
          if (state.selectedEmpacadas[id]) {
            delete state.selectedEmpacadas[id];
          } else {
            state.selectedEmpacadas[id] = true;
          }
        }),

      // Idempotent removal of a single id from the A-Preparar selection bucket.
      // Used after a successful single "Iniciar" so a stale id does not leak
      // into a later bulk action (which would send an invalid, already-advanced id).
      removeConfirmada: (id) =>
        set((state) => {
          delete state.selectedConfirmadas[id];
        }),

      selectAllConfirmadas: (ids) =>
        set((state) => {
          const allSelected = ids.every((id) => state.selectedConfirmadas[id]);
          if (allSelected) {
            state.selectedConfirmadas = {};
          } else {
            ids.forEach((id) => {
              state.selectedConfirmadas[id] = true;
            });
          }
        }),

      selectAllEmpacadas: (ids) =>
        set((state) => {
          const allSelected = ids.every((id) => state.selectedEmpacadas[id]);
          if (allSelected) {
            state.selectedEmpacadas = {};
          } else {
            ids.forEach((id) => {
              state.selectedEmpacadas[id] = true;
            });
          }
        }),

      clearConfirmadas: () =>
        set((state) => {
          state.selectedConfirmadas = {};
        }),

      clearEmpacadas: () =>
        set((state) => {
          state.selectedEmpacadas = {};
        }),

      setBultos: (id, count) =>
        set((state) => {
          const val = Math.max(1, Math.min(99, count));
          state.bultosCounts[id] = val;
        }),

      getBultos: (id) => get().bultosCounts[id] ?? 1,

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

      // ── Wizard draft actions ─────────────────────────────────────────────────

      setStep: (step) =>
        set((state) => {
          state.viajeDraft.step = step;
        }),

      toggleDraftEmpacada: (id) =>
        set((state) => {
          if (state.viajeDraft.selectedEmpacadaIds[id]) {
            delete state.viajeDraft.selectedEmpacadaIds[id];
          } else {
            state.viajeDraft.selectedEmpacadaIds[id] = true;
          }
        }),

      setAssignment: ({ choferId, vehiculoId, depositoId, fechaSalida }) =>
        set((state) => {
          state.viajeDraft.choferId = choferId;
          state.viajeDraft.vehiculoId = vehiculoId;
          state.viajeDraft.depositoId = depositoId;
          state.viajeDraft.fechaSalida = fechaSalida;
        }),

      setOrderedStops: (stops, hojaRutaId) =>
        set((state) => {
          state.viajeDraft.orderedStops = stops;
          state.viajeDraft.hojaRutaId = hojaRutaId;
        }),

      moveStop: (index, direction) =>
        set((state) => {
          const reordered = reorderStop(state.viajeDraft.orderedStops, index, direction);
          state.viajeDraft.orderedStops = assignOrderNumbers(reordered);
        }),

      resetViajeDraft: () =>
        set((state) => {
          state.viajeDraft = { ...INITIAL_VIAJE_DRAFT, fechaSalida: new Date().toISOString() };
        }),

      reset: () =>
        set((state) => {
          state.selectedConfirmadas = {};
          state.selectedEmpacadas = {};
          state.bultosCounts = {};
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


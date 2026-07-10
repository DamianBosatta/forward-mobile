import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
// Caja Store – Estado de la caja activa en tiempo real
// ─────────────────────────────────────────────────────────────────────────────

// Inline to avoid circular dep with api-client package
interface Caja {
  id: string
  fecha: string
  usuarioAperturaId: string
  usuarioApertura: string
  saldoInicial: number
  estado: 'Abierta' | 'Cerrada'
  fechaCierre?: string
  saldoFinalDeclarado?: number
  saldoFinalSistema?: number
  diferencia?: number
}


interface CajaState {
  cajaActiva: Caja | null
  isLoading: boolean

  setCajaActiva: (caja: Caja | null) => void
  setLoading: (loading: boolean) => void
}

export const useCajaStore = create<CajaState>()((set) => ({
  cajaActiva: null,
  isLoading: false,

  setCajaActiva: (caja) => set({ cajaActiva: caja }),
  setLoading: (loading) => set({ isLoading: loading }),
}))

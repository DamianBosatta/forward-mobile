import { create } from 'zustand'
import type { MovimientoCuentaDto } from '@/libs/api-client/types'

interface FinanzasState {
  selectedCuentaId: string | null
  setSelectedCuentaId: (id: string | null) => void
  isTransferModalVisible: boolean
  setTransferModalVisible: (visible: boolean) => void
  isChequeModalVisible: boolean
  setChequeModalVisible: (visible: boolean) => void
  selectedMovimiento: MovimientoCuentaDto | null
  setSelectedMovimiento: (mov: MovimientoCuentaDto | null) => void
  isMovimientoDetailModalVisible: boolean
  setMovimientoDetailModalVisible: (visible: boolean) => void
}

export const useFinanzasStore = create<FinanzasState>((set) => ({
  selectedCuentaId: null,
  setSelectedCuentaId: (id) => set({ selectedCuentaId: id }),
  isTransferModalVisible: false,
  setTransferModalVisible: (visible) => set({ isTransferModalVisible: visible }),
  isChequeModalVisible: false,
  setChequeModalVisible: (visible) => set({ isChequeModalVisible: visible }),
  selectedMovimiento: null,
  setSelectedMovimiento: (mov) => set({ selectedMovimiento: mov }),
  isMovimientoDetailModalVisible: false,
  setMovimientoDetailModalVisible: (visible) => set({ isMovimientoDetailModalVisible: visible }),
}))

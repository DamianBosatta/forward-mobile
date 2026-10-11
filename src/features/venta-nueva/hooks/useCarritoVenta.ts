import { create } from 'zustand'
import type { CatalogoStockItem } from '@/libs/api-client'
import { agregar, quitar, reemplazar, restar, sumar, type LineaCarrito } from '../lib/carrito'

interface CarritoVentaState {
  lineas: LineaCarrito[]
  agregar: (producto: CatalogoStockItem) => void
  sumar: (productoId: string) => void
  restar: (productoId: string) => void
  quitar: (productoId: string) => void
  reemplazar: (linea: LineaCarrito) => void
  vaciar: () => void
}

/** Estado del carrito de la venta nueva. La lógica vive en lib/carrito (funciones puras). */
export const useCarritoVenta = create<CarritoVentaState>((set) => ({
  lineas: [],
  agregar: (producto) => set((s) => ({ lineas: agregar(s.lineas, producto) })),
  sumar: (productoId) => set((s) => ({ lineas: sumar(s.lineas, productoId) })),
  restar: (productoId) => set((s) => ({ lineas: restar(s.lineas, productoId) })),
  quitar: (productoId) => set((s) => ({ lineas: quitar(s.lineas, productoId) })),
  reemplazar: (linea) => set((s) => ({ lineas: reemplazar(s.lineas, linea) })),
  vaciar: () => set({ lineas: [] }),
}))

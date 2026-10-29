import { create } from 'zustand'
import type { CatalogoStockItem } from '@/libs/api-client'
import { agregar, quitar, reemplazar, type LineaCarrito } from '../lib/carrito'
import { repartirFragancias } from '../lib/fragancias'

interface CarritoVentaState {
  lineas: LineaCarrito[]
  agregar: (producto: CatalogoStockItem) => void
  quitar: (productoId: string) => void
  reemplazar: (linea: LineaCarrito) => void
  /** Reparte una línea padre en sus fragancias (cantidad por variante; 0 = fuera; un descuento para todas). */
  repartirFragancias: (padreId: string, variantes: CatalogoStockItem[], cantidades: Record<string, number>, descuentoPct: number) => void
  vaciar: () => void
}

/** Estado del carrito de la venta nueva. La lógica vive en lib/carrito (funciones puras). */
export const useCarritoVenta = create<CarritoVentaState>((set) => ({
  lineas: [],
  agregar: (producto) => set((s) => ({ lineas: agregar(s.lineas, producto) })),
  quitar: (productoId) => set((s) => ({ lineas: quitar(s.lineas, productoId) })),
  reemplazar: (linea) => set((s) => ({ lineas: reemplazar(s.lineas, linea) })),
  repartirFragancias: (padreId, variantes, cantidades, descuentoPct) =>
    set((s) => ({ lineas: repartirFragancias(s.lineas, padreId, variantes, cantidades, descuentoPct) })),
  vaciar: () => set({ lineas: [] }),
}))

import { METODO_ENTREGA } from '@/features/ventas/lib/venta-form-retiro'

/**
 * Flete de la venta (D-025): es lo que escribe la persona y solo en un envío con logística propia.
 * No hay flete automático (5 % de la orden): esa regla no existe en la web ni en el backend.
 */
export const fleteDeLaVenta = (metodoEntrega: number, texto: string): number =>
  metodoEntrega === METODO_ENTREGA.Logistica ? parseFloat(texto) || 0 : 0

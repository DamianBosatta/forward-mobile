import { BandejaAutorizaciones } from '@/features/autorizaciones/components/BandejaAutorizaciones'
import { VentaDetalle } from '../ventas/[id]'

/** Autorizaciones (fase 4.1). El detalle, por ahora, es el de la venta. */
export default function AutorizacionesScreen() {
  return (
    <BandejaAutorizaciones
      rutaDetalle={(id) => `/(tabs)/ventas/${id}`}
      detalle={(id, cerrar) => <VentaDetalle key={id} id={id} onVolver={cerrar} />}
    />
  )
}

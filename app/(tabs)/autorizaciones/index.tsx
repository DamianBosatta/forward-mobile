import { BandejaAutorizaciones } from '@/features/autorizaciones/components/BandejaAutorizaciones'
import { DetalleAutorizacion } from '@/features/autorizaciones/components/DetalleAutorizacion'

/** Autorizaciones (fase 4.1): bandeja y, en tablet horizontal, el detalle para autorizar al lado. */
export default function AutorizacionesScreen() {
  return (
    <BandejaAutorizaciones
      rutaDetalle={(id) => `/(tabs)/autorizaciones/${id}`}
      detalle={(id, cerrar) => <DetalleAutorizacion key={id} id={id} onVolver={cerrar} />}
    />
  )
}

import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { DetalleAutorizacion } from '@/features/autorizaciones/components/DetalleAutorizacion'

/** Ruta `autorizaciones/[id]`: el detalle para autorizar en teléfono. */
export default function AutorizarVentaScreen() {
  const { id } = useParametrosDeRuta({ id: idDeRuta })
  return id ? <DetalleAutorizacion id={id} /> : null
}

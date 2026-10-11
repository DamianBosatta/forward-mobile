import { useLocalSearchParams } from 'expo-router'
import { DetalleAutorizacion } from '@/features/autorizaciones/components/DetalleAutorizacion'

/** Ruta `autorizaciones/[id]`: el detalle para autorizar en teléfono. */
export default function AutorizarVentaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <DetalleAutorizacion id={id} />
}

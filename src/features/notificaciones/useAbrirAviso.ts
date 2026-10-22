import { useRouter } from 'expo-router'
import { useMarcarAvisosLeidos, type Aviso } from '@/libs/api-client/notificaciones'
import { rutaAlTocarAviso } from './bandeja'

/** Tocar un aviso: lo marca leído y, si mobile tiene la pantalla de destino, va ahí. Lo usan la bandeja y el panel de tablet. */
export function useAbrirAviso() {
  const router = useRouter()
  const marcar = useMarcarAvisosLeidos()
  const abrir = (aviso: Pick<Aviso, 'id' | 'leida' | 'accion'>) => {
    if (!aviso.leida) marcar.mutate([aviso.id])
    const ruta = rutaAlTocarAviso(aviso.accion)
    if (ruta) router.push(ruta as never)
  }
  return { abrir, marcar }
}

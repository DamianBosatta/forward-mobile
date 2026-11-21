import { Bell } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useAvisosNoLeidos } from '@/features/notificaciones'
import type { TopBarAction } from '@/core/ui/fw'

/**
 * La campana de Avisos de la barra de Inicio (L4 y L12: solo Inicio). Abre la bandeja y lleva la cuenta de
 * no leídas de `useAvisosNoLeidos`; sin avisos sin leer no hay pastilla.
 */
export function useAccionAvisos(): TopBarAction {
  const router = useRouter()
  const noLeidas = useAvisosNoLeidos()
  return {
    icon: Bell,
    accessibilityLabel: noLeidas > 0 ? `Avisos, ${noLeidas} sin leer` : 'Avisos',
    onPress: () => router.push('/(tabs)/avisos' as never),
    badge: noLeidas,
  }
}

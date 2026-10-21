import { useAuthStore } from '../../libs/store/auth.store'
import { ChoferDashboard } from '@/features/logistica/components/ChoferDashboard'
import { InicioScreen } from '@/features/inicio/components/InicioScreen'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { esChofer } from '@/src/components/layout/menuModules'

export default function InicioRoute() {
  const { canDo } = useAuthStore()
  // El chofer lee ventas (para ver el pedido de una parada) pero no las crea. Su consola sigue
  // siendo la de siempre hasta la fase 5.
  if (esChofer(canDo)) return <ChoferDashboard />
  // En teléfono, Inicio lleva la barra de accesos rápidos (PR 0.3).
  return (
    <ConAccesosRapidos activa="inicio">
      <InicioScreen />
    </ConAccesosRapidos>
  )
}

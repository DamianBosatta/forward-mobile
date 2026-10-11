import { useAuthStore } from '../../libs/store/auth.store'
import { ChoferDashboard } from '@/features/logistica/components/ChoferDashboard'
import { InicioScreen } from '@/features/inicio/components/InicioScreen'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'

export default function InicioRoute() {
  const { isAdmin, isSuperAdmin, canDo } = useAuthStore()
  // El chofer lee ventas (para ver el pedido de una parada) pero no las crea: eso lo distingue
  // del vendedor. Su consola sigue siendo la de siempre hasta la fase 5.
  const isChofer = !isAdmin() && !isSuperAdmin() && canDo('MOD_VIAJES', 'read') && !canDo('MOD_VENTAS', 'create')
  if (isChofer) return <ChoferDashboard />
  // En teléfono, Inicio lleva la barra de accesos rápidos (PR 0.3).
  return (
    <ConAccesosRapidos activa="inicio">
      <InicioScreen />
    </ConAccesosRapidos>
  )
}

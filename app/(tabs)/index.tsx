import { useAuthStore } from '../../libs/store/auth.store'
import { ChoferDashboard } from '@/features/logistica/components/ChoferDashboard'
import { InicioScreen } from '@/features/inicio/components/InicioScreen'
import { MiDiaScreen } from '@/features/inicio/components/MiDiaScreen'
import { varianteDeInicio } from '@/features/inicio/lib/varianteDeInicio'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { esChofer } from '@/src/components/layout/menuModules'

export default function InicioRoute() {
  const { canDo, hasCapability } = useAuthStore()
  // El chofer lee ventas (para ver el pedido de una parada) pero no las crea. Su consola sigue
  // siendo la de siempre hasta la fase 5. El resto, como la web: CAP_VER_COSTOS → gestión, si no Mi día.
  const variante = varianteDeInicio({ esChofer: esChofer(canDo), veCostos: hasCapability('CAP_VER_COSTOS') })
  if (variante === 'chofer') return <ChoferDashboard />
  // En teléfono, Inicio lleva la barra de accesos rápidos (PR 0.3).
  return (
    <ConAccesosRapidos activa="inicio">
      {variante === 'gestion' ? <InicioScreen /> : <MiDiaScreen />}
    </ConAccesosRapidos>
  )
}

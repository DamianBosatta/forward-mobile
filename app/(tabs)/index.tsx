import { useAuthStore } from '../../libs/store/auth.store'
import ConsolaChoferScreen from './logistica/consola'
import { InicioScreen } from '@/features/inicio/components/InicioScreen'
import { MiDiaScreen } from '@/features/inicio/components/MiDiaScreen'
import { varianteDeInicio } from '@/features/inicio/lib/varianteDeInicio'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { esChofer } from '@/src/components/layout/menuModules'

export default function InicioRoute() {
  const { canDo, hasCapability } = useAuthStore()
  // El chofer lee ventas (para ver el pedido de una parada) pero no las crea. Su inicio es la pantalla de
  // su ruta del día (la consola), sin duplicarla. El resto, como la web: CAP_VER_COSTOS → gestión, si no Mi día.
  const variante = varianteDeInicio({ esChofer: esChofer(canDo), veCostos: hasCapability('CAP_VER_COSTOS') })
  if (variante === 'chofer') return <ConsolaChoferScreen />
  // En teléfono, Inicio lleva la barra de accesos rápidos (PR 0.3).
  return (
    <ConAccesosRapidos activa="inicio">
      {variante === 'gestion' ? <InicioScreen /> : <MiDiaScreen />}
    </ConAccesosRapidos>
  )
}

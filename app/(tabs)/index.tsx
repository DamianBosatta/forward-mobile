import { useAuthStore } from '../../libs/store/auth.store'
import ConsolaChoferScreen from './logistica/consola'
import { InicioScreen } from '@/features/inicio/components/InicioScreen'
import { InicioDeposito } from '@/features/inicio/components/InicioDeposito'
import { MiDiaScreen } from '@/features/inicio/components/MiDiaScreen'
import { varianteDeInicio } from '@/features/inicio/lib/varianteDeInicio'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { esChofer } from '@/src/components/layout/menuModules'

/** Depósito: no lee ventas y maneja stock o compras. Por permisos de hoy (sin capacidades nuevas), nunca por rol (X3). */
const esDepositoPorPermisos = (canDo: (m: 'MOD_VENTAS' | 'MOD_STOCK' | 'MOD_COMPRAS', a: 'read') => boolean) =>
  !canDo('MOD_VENTAS', 'read') && (canDo('MOD_STOCK', 'read') || canDo('MOD_COMPRAS', 'read'))

export default function InicioRoute() {
  const { canDo, hasCapability } = useAuthStore()
  // El chofer lee ventas (para ver el pedido de una parada) pero no las crea. Su inicio es la pantalla de
  // su ruta del día (la consola), sin duplicarla. El resto, un tablero por perfil: CAP_VER_COSTOS → administración,
  // depósito por sus permisos y, si no, Mi día del vendedor.
  const variante = varianteDeInicio({
    esChofer: esChofer(canDo),
    veCostos: hasCapability('CAP_VER_COSTOS'),
    esDeposito: esDepositoPorPermisos(canDo),
  })
  // En teléfono, Inicio lleva la barra de accesos rápidos: Nueva venta al centro si puede vender; la del chofer, "Mi ruta" y "Cobros".
  return (
    <ConAccesosRapidos activa="inicio">
      {variante === 'chofer' ? <ConsolaChoferScreen /> : variante === 'gestion' ? <InicioScreen /> : variante === 'deposito' ? <InicioDeposito /> : <MiDiaScreen />}
    </ConAccesosRapidos>
  )
}

import { BRAND } from '@/libs/theme'
import { resolverEstadoVenta, type EstadoVentaNombre } from '@/libs/reglas/estados'
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  ShieldCheck,
  XCircle,
  AlertCircle,
  FileText
} from 'lucide-react-native'

type Colores = { primary: string; danger: string; textMuted: string; surface2: string }
interface ConfigEstado { label: string; color: string; Icon: typeof Clock; bg: string }

/**
 * Cómo muestra mobile cada estado de venta (etiqueta, color e ícono). Exhaustivo: un estado nuevo
 * del enum sin entrada acá no compila. Las etiquetas son las de mobile ("Preparando", "Entregada"),
 * no las de la web (`etiqueta` de libs/reglas/estados): la elección entre las dos es del dueño.
 * NoEntregada, Vencido y RechazadaAutorizacion se siguen mostrando como "Otros", como antes.
 */
const ESTADO_VENTA_MOBILE = {
  Pendiente: () => ({ label: 'Pendiente', color: '#94a3b8', Icon: Clock, bg: '#94a3b815' }),
  Confirmada: () => ({ label: 'Confirmada', color: BRAND.blue, Icon: CheckCircle2, bg: `${BRAND.blue}15` }),
  EnPreparacion: () => ({ label: 'Preparando', color: '#8b5cf6', Icon: Package, bg: '#8b5cf615' }),
  Empacada: () => ({ label: 'Preparando', color: '#8b5cf6', Icon: Package, bg: '#8b5cf615' }),
  EnRuta: () => ({ label: 'En Ruta', color: '#6366f1', Icon: Truck, bg: '#6366f115' }),
  Entregada: (colors) => ({ label: 'Entregada', color: colors.primary, Icon: ShieldCheck, bg: `${colors.primary}15` }),
  Anulada: (colors) => ({ label: 'Anulada', color: colors.danger, Icon: XCircle, bg: `${colors.danger}15` }),
  PendienteAutorizacion: (colors) => ({ label: 'Por Autorizar', color: colors.danger, Icon: AlertCircle, bg: `${colors.danger}15` }),
  NoEntregada: otros,
  Vencido: otros,
  RechazadaAutorizacion: otros,
} satisfies Record<EstadoVentaNombre, (colors: Colores) => ConfigEstado>

function otros(colors: Colores): ConfigEstado {
  return { label: 'Otros', color: colors.textMuted, Icon: FileText, bg: colors.surface2 }
}

/**
 * Configuración visual por estado. `estado` llega como número, número en texto o nombre según el
 * endpoint; un valor que el enum no conoce cae en "Otros", nunca en un estado real.
 */
export const getVentaStatusConfig = (estado: string | number | null | undefined, colors: Colores): ConfigEstado => {
  const r = resolverEstadoVenta(estado)
  return r === undefined ? otros(colors) : ESTADO_VENTA_MOBILE[r.nombre](colors)
}

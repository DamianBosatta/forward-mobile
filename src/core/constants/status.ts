import { BRAND } from '@/libs/theme'
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

/**
 * SOURCE OF TRUTH: Estados de Venta
 * Mapeo de IDs del backend a lógica de negocio y UI
 */
export const VENTA_ESTADOS = {
  PENDIENTE: '1',
  CONFIRMADA: '2',
  EN_PREPARACION: '3',
  EMPACADA: '4',
  EN_RUTA: '5',
  ENTREGADA: '6',
  ANULADA: '8',
  PENDIENTE_AUTORIZACION: '9',
} as const

export type VentaEstado = typeof VENTA_ESTADOS[keyof typeof VENTA_ESTADOS]

/**
 * Configuración visual por estado
 */
export const getVentaStatusConfig = (estado: any, colors: any) => {
  const s = String(estado)

  // The API returns `estado` either as a numeric code ('1'-'9') OR as the enum name
  // ('Confirmada', 'Pendiente', ...) depending on the endpoint. Map BOTH so the badge
  // never falls to the "Otros" fallback for a real estado.
  switch (s) {
    case VENTA_ESTADOS.PENDIENTE:
    case 'Pendiente':
      return { label: 'Pendiente', color: '#94a3b8', Icon: Clock, bg: '#94a3b815' }

    case VENTA_ESTADOS.CONFIRMADA:
    case 'Confirmada':
      return { label: 'Confirmada', color: BRAND.blue, Icon: CheckCircle2, bg: `${BRAND.blue}15` }

    case VENTA_ESTADOS.EN_PREPARACION:
    case VENTA_ESTADOS.EMPACADA:
    case 'EnPreparacion':
    case 'Empacada':
      return { label: 'Preparando', color: '#8b5cf6', Icon: Package, bg: '#8b5cf615' }

    case VENTA_ESTADOS.EN_RUTA:
    case 'EnRuta':
      return { label: 'En Ruta', color: '#6366f1', Icon: Truck, bg: '#6366f115' }

    case VENTA_ESTADOS.ENTREGADA:
    case 'Entregada':
      return { label: 'Entregada', color: colors.primary, Icon: ShieldCheck, bg: `${colors.primary}15` }

    case VENTA_ESTADOS.ANULADA:
    case 'Anulada':
      return { label: 'Anulada', color: colors.danger, Icon: XCircle, bg: `${colors.danger}15` }

    case VENTA_ESTADOS.PENDIENTE_AUTORIZACION:
    case 'PendienteAutorizacion':
      return { label: 'Por Autorizar', color: colors.danger, Icon: AlertCircle, bg: `${colors.danger}15` }

    default:
      return { label: 'Otros', color: colors.textMuted, Icon: FileText, bg: colors.surface2 }
  }
}

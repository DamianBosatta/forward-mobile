import { BRAND } from '@/libs/theme'
import {
  FileText,
  CheckCircle2,
  Truck,
  XCircle
} from 'lucide-react-native'

/**
 * SOURCE OF TRUTH: Estados de Compra
 */
export const COMPRA_ESTADOS = {
  PRESUPUESTO: '1',
  CONFIRMADO: '2',
  RECIBIDA: '3',
  CANCELADA: '4',
} as const

export const getCompraStatusConfig = (estado: any, colors: any) => {
  const s = String(estado)

  switch (s) {
    case COMPRA_ESTADOS.PRESUPUESTO:
    case 'Presupuesto':
      return { label: 'Pendiente', color: '#94a3b8', Icon: FileText, bg: '#94a3b815' }

    case COMPRA_ESTADOS.CONFIRMADO:
    case 'Confirmado':
      return { label: 'Confirmado', color: BRAND.blue, Icon: CheckCircle2, bg: `${BRAND.blue}15` }

    case COMPRA_ESTADOS.RECIBIDA:
    case 'Recibida':
      return { label: 'Recibida', color: BRAND.lime, Icon: Truck, bg: `${BRAND.lime}15` }

    case COMPRA_ESTADOS.CANCELADA:
    case 'Cancelada':
      return { label: 'Anulada', color: colors.danger, Icon: XCircle, bg: `${colors.danger}15` }

    default:
      return { label: s, color: colors.textMuted, Icon: FileText, bg: colors.surface2 }
  }
}

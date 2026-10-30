import React from 'react'
import { Text, View } from 'react-native'
import { ShoppingCart } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { FilaDeSocio, StatusChip, formatImporte } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import type { SocioListDto } from '@/libs/api-client/types'
import { saldoDelProveedor } from '../lib/proveedor'

interface ProveedorCardProps {
  proveedor: SocioListDto
  onPress: () => void
  /** En tablet, el proveedor abierto en el panel de la derecha. */
  seleccionado?: boolean
  /** Si viene, la fila ofrece "Nueva compra" (el padre decide con el permiso de MOD_COMPRAS). */
  onNuevaCompra?: () => void
}

/**
 * Fila de proveedor (lámina proveedores, deltas contra clientes): razón social en la línea 1 con el saldo a la
 * derecha ("Le debemos $ X", "A favor $ X" o "Al día"), CUIT en la línea 2, chip "Faltan datos" si el servidor lo
 * marca y "Nueva compra" como acción rápida. El saldo solo con `puedeVerSaldo` y MOD_CC:read.
 */
export function ProveedorCard({ proveedor, onPress, seleccionado = false, onNuevaCompra }: ProveedorCardProps) {
  const c = useColors()
  const { canRead } = usePermissions()
  const cuit = proveedor.cuit?.trim() ? `CUIT ${proveedor.cuit.trim()}` : 'Sin CUIT cargado'
  const saldo = proveedor.puedeVerSaldo && canRead('MOD_CC') ? saldoDelProveedor(proveedor.saldoAmount) : null

  return (
    <FilaDeSocio
      titulo={proveedor.razonSocial}
      linea2={cuit}
      seleccionado={seleccionado}
      onPress={onPress}
      accessibilityLabel={[proveedor.razonSocial, proveedor.requiereCompletar && 'faltan datos', saldo && `${saldo.etiqueta} ${formatImporte(saldo.monto)}`].filter(Boolean).join(', ')}
      derecha={
        saldo ? (
          saldo.etiqueta === 'Al día' ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{saldo.etiqueta}</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{saldo.etiqueta}</Text>
              <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(saldo.monto)}</Text>
            </View>
          )
        ) : undefined
      }
      extra={proveedor.requiereCompletar ? <StatusChip estado="pendiente" label="Faltan datos" /> : null}
      accion={onNuevaCompra ? { icono: ShoppingCart, label: 'Nueva compra', hint: proveedor.razonSocial, onPress: onNuevaCompra } : undefined}
    />
  )
}

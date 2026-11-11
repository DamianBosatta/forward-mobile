import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ShoppingCart } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import type { SocioListDto } from '@/libs/api-client/types'
import { inicialesDeDireccion } from '@/features/clientes/lib/cliente'
import { saldoDelProveedor } from '../lib/proveedor'

interface ProveedorCardProps {
  proveedor: SocioListDto
  onPress: () => void
  /** En tablet, el proveedor abierto en el panel de la derecha. */
  seleccionado?: boolean
  /** Si viene, la fila ofrece "Nueva compra" (el padre decide con el permiso de MOD_COMPRAS). */
  onNuevaCompra?: () => void
  /** Dónde cae la fila en la tarjeta de la lista (redondea esa punta). */
  primera?: boolean
  ultima?: boolean
}

/**
 * Fila de proveedor con el estilo de la lista de Clientes (`ClienteCard variante="cartera"`): iniciales de la razón
 * social, razón social y CUIT, el renglón de chips ("Faltan datos") con el saldo a la derecha ("Le debemos $ X",
 * "A favor $ X" o "Al día") y "Nueva compra" en el botón redondo donde Clientes pone Llamar.
 * El saldo solo con `puedeVerSaldo` y MOD_CC:read.
 */
export function ProveedorCard({ proveedor, onPress, seleccionado = false, onNuevaCompra, primera = false, ultima = false }: ProveedorCardProps) {
  const c = useColors()
  const { canRead } = usePermissions()
  const cuit = proveedor.cuit?.trim() ? `CUIT ${proveedor.cuit.trim()}` : 'Sin CUIT cargado'
  const saldo = proveedor.puedeVerSaldo && canRead('MOD_CC') ? saldoDelProveedor(proveedor.saldoAmount) : null
  const secundario = (t: string) => <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{t}</Text>
  const conChips = proveedor.requiereCompletar || saldo

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[proveedor.razonSocial, proveedor.requiereCompletar && 'faltan datos', saldo && `${saldo.etiqueta} ${formatImporte(saldo.monto)}`].filter(Boolean).join(', ')}
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[3],
        minHeight: 64,
        marginHorizontal: space[4],
        paddingVertical: space[3],
        paddingLeft: space[4],
        paddingRight: space[2],
        overflow: 'hidden',
        backgroundColor: seleccionado ? c.brandSoft : c.surface,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: c.surface2,
        ...(primera ? { borderTopLeftRadius: radii.tarjeta, borderTopRightRadius: radii.tarjeta } : null),
        ...(ultima ? { borderBottomLeftRadius: radii.tarjeta, borderBottomRightRadius: radii.tarjeta } : null),
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{inicialesDeDireccion(proveedor.razonSocial ?? '')}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{proveedor.razonSocial}</Text>
        <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>{cuit}</Text>
        {conChips ? (
          <View style={{ marginTop: space[2], flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', rowGap: space[1], columnGap: space[2] }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1], flexShrink: 1 }}>
              {proveedor.requiereCompletar ? <StatusChip estado="pendiente" label="Faltan datos" /> : null}
              {saldo?.etiqueta === 'Al día' ? secundario(saldo.etiqueta) : null}
            </View>
            {saldo && saldo.etiqueta !== 'Al día' ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1], marginLeft: 'auto' }}>
                {secundario(saldo.etiqueta)}
                <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(saldo.monto)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {onNuevaCompra ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nueva compra"
          accessibilityHint={proveedor.razonSocial}
          onPress={onNuevaCompra}
          style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <ShoppingCart size={20} color={c.brandInk} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}

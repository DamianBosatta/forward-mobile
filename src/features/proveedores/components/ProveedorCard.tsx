import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ShoppingCart } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatearCuit } from '@/libs/reglas/cuit'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import type { SocioListDto } from '@/libs/api-client/types'
import { inicialesDeDireccion } from '@/features/clientes/lib/cliente'
import { FALTAN_DATOS_DE_COMPRA, saldoDelProveedor } from '../lib/proveedor'

interface ProveedorCardProps {
  proveedor: SocioListDto
  onPress: () => void
  /** En tablet, el proveedor abierto en el panel de la derecha. */
  seleccionado?: boolean
  /** Si viene, la fila ofrece "Nueva compra" (el padre decide con el permiso de MOD_COMPRAS). */
  onNuevaCompra?: () => void
}

/**
 * Fila de proveedor con el estilo de la lista de Clientes (`ClienteCard variante="cartera"`): iniciales de la razón
 * social y CUIT, el chip "Faltan datos de compra", el saldo en su renglón ("Le debemos $ X", "A favor $ X" o "Al día")
 * y "Comprar" (accesible como "Nueva compra") en una pastilla donde Clientes pone Llamar.
 * El saldo solo con `puedeVerSaldo` y MOD_CC:read.
 */
export function ProveedorCard({ proveedor, onPress, seleccionado = false, onNuevaCompra }: ProveedorCardProps) {
  const c = useColors()
  const { canRead } = usePermissions()
  const cuit = proveedor.cuit?.trim() ? `CUIT ${formatearCuit(proveedor.cuit.trim())}` : 'Sin CUIT cargado'
  const saldo = proveedor.puedeVerSaldo && canRead('MOD_CC') ? saldoDelProveedor(proveedor.saldoAmount) : null
  const secundario = (t: string) => <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{t}</Text>

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
        marginBottom: space[2],
        borderRadius: radii.fila,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{inicialesDeDireccion(proveedor.razonSocial ?? '')}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{proveedor.razonSocial}</Text>
        <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>{cuit}</Text>
        {proveedor.requiereCompletar ? (
          // MC-7: la falta de datos es un aviso (ámbar), no un estado "pendiente"; va en su renglón.
          <View testID="chips-proveedor" style={{ marginTop: space[2], flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1] }}>
            <StatusChip estado="porAutorizar" label={FALTAN_DATOS_DE_COMPRA} />
          </View>
        ) : null}
        {saldo ? (
          // MC-7/MP-18: el saldo ("Le debemos $ X", "A favor $ X" o "Al día") en su propio renglón, pegado a la izquierda.
          <View testID="saldo-proveedor" style={{ marginTop: space[2], flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
            {secundario(saldo.etiqueta)}
            {saldo.etiqueta !== 'Al día' ? <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(saldo.monto)}</Text> : null}
          </View>
        ) : null}
      </View>
      {onNuevaCompra ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nueva compra"
          accessibilityHint={proveedor.razonSocial}
          onPress={onNuevaCompra}
          android_ripple={{ color: c.surface2 }}
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: space[1], paddingHorizontal: space[3], borderRadius: radii.pastilla, backgroundColor: c.surfaceAlt }}
        >
          <ShoppingCart size={18} color={c.brandInk} />
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Comprar</Text>
        </Pressable>
      ) : null}
    </Pressable>
  )
}

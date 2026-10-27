import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Button, StatusChip, formatImporte } from '@/core/ui/fw'
import type { SocioListDto } from '@/libs/api-client/types'
import { saldoDelProveedor } from '../lib/proveedor'

interface ProveedorCardProps {
  proveedor: SocioListDto
  onPress: () => void
  /** En tablet, el proveedor abierto en el panel de la derecha. */
  seleccionado?: boolean
  /** Si viene, la tarjeta ofrece "Nueva compra" (el padre decide con el permiso de MOD_COMPRAS). */
  onNuevaCompra?: () => void
}

/**
 * Tarjeta de proveedor (lámina Proveedores): razón social como título, CUIT debajo y, si el
 * servidor deja ver el saldo, cuánto se le debe. "Faltan datos" cuando el servidor lo marca para completar.
 */
export function ProveedorCard({ proveedor, onPress, seleccionado = false, onNuevaCompra }: ProveedorCardProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const cuit = proveedor.cuit?.trim() ? `CUIT ${proveedor.cuit.trim()}` : 'Sin CUIT cargado'
  const saldo = proveedor.puedeVerSaldo ? saldoDelProveedor(proveedor.saldoAmount) : null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[proveedor.razonSocial, proveedor.requiereCompletar && 'faltan datos', saldo && `${saldo.etiqueta} ${formatImporte(saldo.monto)}`].filter(Boolean).join(', ')}
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          gap: space[1],
          padding: space[4],
          borderRadius: radii.tarjeta,
          backgroundColor: seleccionado ? c.brandSoft : c.surface,
          borderWidth: seleccionado ? 2 : 0,
          borderColor: c.brand,
          opacity: pressed ? 0.85 : 1,
        },
        sombra,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text, flexShrink: 1 }}>{proveedor.razonSocial}</Text>
        {proveedor.requiereCompletar ? <StatusChip estado="pendiente" label="Faltan datos" /> : null}
      </View>
      <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>{cuit}</Text>
      {saldo ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{saldo.etiqueta}</Text>
          <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(saldo.monto)}</Text>
        </View>
      ) : null}
      {onNuevaCompra ? (
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[1] }}>
          <View style={{ flex: 1 }}><Button label="Nueva compra" onPress={onNuevaCompra} /></View>
          <View style={{ flex: 1 }}><Button label="Ver ficha" variant="secundario" onPress={onPress} /></View>
        </View>
      ) : null}
    </Pressable>
  )
}

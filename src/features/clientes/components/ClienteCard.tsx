import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { SocioListDto } from '@/libs/api-client/types'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '../lib/cliente'

interface ClienteCardProps {
  cliente: SocioListDto
  onPress: () => void
  /** En tablet, el cliente abierto en el panel de la derecha. */
  seleccionado?: boolean
}

/**
 * Tarjeta de cliente (lámina Clientes): la dirección de entrega es el título y el nombre va
 * debajo, aparte. El saldo se muestra solo si el servidor dice que este usuario puede verlo.
 */
export function ClienteCard({ cliente, onPress, seleccionado = false }: ClienteCardProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const direccion = direccionDeEntrega(cliente)
  const nombre = nombreDelCliente(cliente)
  const saldo = cliente.puedeVerSaldo ? formatImporte(cliente.saldoAmount) : null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[direccion, nombre, saldo && `saldo ${saldo}`].filter(Boolean).join(', ')}
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: space[3],
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
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pastilla,
          backgroundColor: c.brandSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.brandInk }}>
          {inicialesDeDireccion(direccion)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>
          {direccion}
        </Text>
        {nombre ? (
          <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {nombre}
          </Text>
        ) : null}
        {saldo ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Saldo</Text>
            <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{saldo}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

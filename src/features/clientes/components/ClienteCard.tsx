import React from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { Phone } from 'lucide-react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import type { SocioListDto } from '@/libs/api-client/types'
import { urlLlamar } from '../lib/contacto'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '../lib/cliente'

interface ClienteCardProps {
  cliente: SocioListDto
  onPress: () => void
  /** En tablet, el cliente abierto en el panel de la derecha. */
  seleccionado?: boolean
}

/**
 * Tarjeta de cliente (lámina Clientes): la dirección de entrega es el título y el nombre va
 * debajo, aparte. El saldo se muestra solo si el servidor dice que este usuario puede verlo; la
 * deuda vencida, solo si el servidor la informa (la redacta igual que el saldo).
 */
export function ClienteCard({ cliente, onPress, seleccionado = false }: ClienteCardProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const direccion = direccionDeEntrega(cliente)
  const nombre = nombreDelCliente(cliente)
  const saldo = cliente.puedeVerSaldo ? formatImporte(cliente.saldoAmount) : null
  const vencida = cliente.tieneDeudaVencida === true
  const localidad = cliente.localidad?.trim() || null
  const telefono = cliente.telefono?.trim() || null
  // La deuda vencida solo se dice con importe a quien el servidor deja ver el saldo.
  const vencido = vencida && cliente.puedeVerSaldo ? formatImporte(cliente.deudaVencidaAmount) : null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[direccion, vencida && 'deuda vencida', nombre, localidad, saldo && `saldo ${saldo}`].filter(Boolean).join(', ')}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text, flexShrink: 1 }}>
            {direccion}
          </Text>
          {vencida ? <StatusChip estado="anulado" label="Deuda vencida" /> : null}
        </View>
        {nombre ? (
          <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {nombre}
          </Text>
        ) : null}
        {localidad ? (
          <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {localidad}
          </Text>
        ) : null}
        {vencido ? (
          <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.chip.anulado.text }}>{`Vencido ${vencido}`}</Text>
        ) : null}
        {saldo ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Saldo</Text>
            <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{saldo}</Text>
          </View>
        ) : null}
      </View>
      {telefono ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Llamar"
          accessibilityHint={direccion}
          onPress={() => Linking.openURL(urlLlamar(telefono))}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}
        >
          <Phone size={20} color={c.brandInk} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}

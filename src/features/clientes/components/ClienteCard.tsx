import React from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { Phone } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'
import type { SocioListDto } from '@/libs/api-client/types'
import { urlLlamar } from '../lib/contacto'
import { direccionDeEntrega, nombreDelCliente } from '../lib/cliente'

interface ClienteCardProps {
  cliente: SocioListDto
  onPress: () => void
  /** En tablet, el cliente abierto en el panel de la derecha. */
  seleccionado?: boolean
}

/**
 * Fila plana de cliente (lámina ModClientes): sin tarjeta, con una línea abajo. La dirección de entrega es el título y el nombre va
 * debajo, aparte. El saldo se muestra solo si el servidor dice que este usuario puede verlo; la
 * deuda vencida, solo si el servidor la informa (la redacta igual que el saldo).
 */
export function ClienteCard({ cliente, onPress, seleccionado = false }: ClienteCardProps) {
  const c = useColors()
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
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 64,
        paddingVertical: space[3],
        paddingLeft: space[4],
        paddingRight: space[2],
        backgroundColor: seleccionado ? c.brandSoft : c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
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
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', }}
        >
          <Phone size={20} color={c.brandInk} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}

import React from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { Lock, Phone } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
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
 * Cartera ajena: el servidor no manda el nombre del vendedor en el listado.
 * TODO API: `vendedorResponsableNombre` en SocioListDto para decir "Cartera de Lucía R."
 */
export const TAG_CARTERA_AJENA = 'Cartera de otro vendedor'

/**
 * Fila plana de cliente (lámina clientes-lista): la dirección de entrega es el título (línea 1) con el saldo a la
 * derecha; el nombre y la localidad van en la línea 2, aparte. El saldo se muestra solo si el servidor dice que
 * este usuario puede verlo; sin permiso hay un candado y el tag de cartera ajena. La deuda vencida, solo si el
 * servidor la informa (la redacta igual que el saldo).
 */
export function ClienteCard({ cliente, onPress, seleccionado = false }: ClienteCardProps) {
  const c = useColors()
  const direccion = direccionDeEntrega(cliente)
  const nombre = nombreDelCliente(cliente)
  const verSaldo = cliente.puedeVerSaldo
  const saldo = verSaldo ? formatImporte(cliente.saldoAmount) : null
  const sinDeuda = verSaldo && !(cliente.saldoAmount > 0)
  const localidad = cliente.localidad?.trim() || null
  const telefono = cliente.telefono?.trim() || null
  // La deuda vencida solo se dice con importe a quien el servidor deja ver el saldo.
  const vencida = cliente.tieneDeudaVencida === true && verSaldo
  const vencido = vencida ? formatImporte(cliente.deudaVencidaAmount) : null
  const linea2 = [nombre, localidad].filter(Boolean).join(' · ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[direccion, vencida && 'deuda vencida', nombre, localidad, saldo && `saldo ${saldo}`, !verSaldo && TAG_CARTERA_AJENA].filter(Boolean).join(', ')}
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={{
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
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
          <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text, flexShrink: 1 }}>
            {direccion}
          </Text>
          {saldo && !sinDeuda ? (
            <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{saldo}</Text>
          ) : sinDeuda ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Sin deuda</Text>
          ) : (
            <Lock size={16} color={c.textSecondary} accessibilityLabel="Saldo reservado" />
          )}
        </View>
        {linea2 ? (
          <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {linea2}
          </Text>
        ) : null}
        {vencido ? <StatusChip estado="anulado" label={`Vencido ${vencido}`} /> : null}
        {!verSaldo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space[1], backgroundColor: c.surface2, borderRadius: radii.pastilla, paddingVertical: space[1], paddingHorizontal: 10 }}>
            <Lock size={12} color={c.textSecondary} />
            <Text style={[typeScale.etiqueta, { color: c.textSecondary }]}>{TAG_CARTERA_AJENA}</Text>
          </View>
        ) : null}
      </View>
      {telefono ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Llamar"
          accessibilityHint={direccion}
          onPress={() => Linking.openURL(urlLlamar(telefono))}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Phone size={20} color={c.brandInk} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}

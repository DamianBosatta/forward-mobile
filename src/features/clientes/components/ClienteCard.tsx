import React from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { ChevronRight, Lock, Phone } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { FilaDeSocio, StatusChip, formatImporte } from '@/core/ui/fw'
import type { SocioListDto } from '@/libs/api-client/types'
import { urlLlamar } from '../lib/contacto'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '../lib/cliente'
import { ChipAntiguedadDeuda } from '@/features/cuentas/components/ChipAntiguedadDeuda'
import { chipAntiguedadDeuda } from '@/features/cuentas/lib/antiguedadDeuda'

interface ClienteCardProps {
  cliente: SocioListDto
  onPress: () => void
  /** En tablet, el cliente abierto en el panel de la derecha. */
  seleccionado?: boolean
  /** Flecha al final de la fila (lista de cuentas; también con `variante="cartera"`). Por defecto, sin flecha. */
  chevron?: boolean
  /** Chip con la antigüedad de la deuda más vieja (lista "Me deben" de Cuentas). Por defecto, sin chip. */
  conAntiguedad?: boolean
  /**
   * 'fila' (por defecto): la fila plana de siempre. 'cartera': la fila de la lista de Clientes con la visual de
   * "Elegir cliente" de la venta (iniciales, saldo en el renglón de los chips, Llamar redondo; propuesta frames 1 y 2).
   */
  variante?: 'fila' | 'cartera'
  /** Con `variante="cartera"`: dónde cae la fila en la tarjeta de su letra (redondea esa punta). */
  primera?: boolean
  ultima?: boolean
}

/** Cartera ajena: el tag del candado; el nombre del vendedor (si viene) va en la línea "Vendedor: …". */
export const TAG_CARTERA_AJENA = 'Cartera de otro vendedor'
export const SALDO_RESERVADO = 'Saldo reservado'

/**
 * Fila plana de cliente (lámina clientes-lista): la dirección de entrega es el título (línea 1) con el saldo a la
 * derecha; el nombre y la localidad van en la línea 2, aparte. El saldo se muestra solo si el servidor dice que
 * este usuario puede verlo; sin permiso hay un candado y el tag de cartera ajena. La deuda vencida, solo si el
 * servidor la informa (la redacta igual que el saldo).
 */
export function ClienteCard({ cliente, onPress, seleccionado = false, chevron = false, conAntiguedad = false, variante = 'fila', primera = false, ultima = false }: ClienteCardProps) {
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
  const vendedor = cliente.vendedorResponsableNombre?.trim() || null
  // El servidor manda null sin permiso de saldo o sin deuda pendiente; sin dato, ni chip ni texto.
  const dias = conAntiguedad && verSaldo ? cliente.diasDeudaMasVieja : null
  const antiguedad = chipAntiguedadDeuda(dias)?.texto
  const linea2 = [nombre, localidad].filter(Boolean).join(' · ')
  const accessibilityLabel = [direccion, vencida && 'deuda vencida', nombre, localidad, saldo && `saldo ${saldo}`, antiguedad, !verSaldo && TAG_CARTERA_AJENA].filter(Boolean).join(', ')
  const secundario = (t: string) => <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{t}</Text>
  const tagAjena = !verSaldo ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space[1], backgroundColor: c.surface2, borderRadius: radii.pastilla, paddingVertical: space[1], paddingHorizontal: 10 }}>
      <Lock size={12} color={c.textSecondary} />
      <Text style={[typeScale.etiqueta, { color: c.textSecondary }]}>{TAG_CARTERA_AJENA}</Text>
    </View>
  ) : null
  const llamar = telefono ? () => Linking.openURL(urlLlamar(telefono)) : null

  if (variante === 'cartera') {
    const extras = (
      <>
        {/* v2: el candado lleva texto y va debajo del nombre, para que la dirección no se corte. */}
        {!verSaldo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Lock size={14} color={c.textSecondary} />
            {secundario(SALDO_RESERVADO)}
          </View>
        ) : null}
        {sinDeuda ? secundario('Sin deuda') : null}
        {vendedor ? secundario(`Vendedor: ${vendedor}`) : null}
        <ChipAntiguedadDeuda dias={dias} />
        {vencido ? <StatusChip estado="anulado" label={`Vencido ${vencido}`} /> : null}
        {tagAjena}
      </>
    )
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
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
        <View
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{inicialesDeDireccion(direccion)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{direccion}</Text>
          {linea2 ? <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>{linea2}</Text> : null}
          <View style={{ marginTop: space[2], flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', rowGap: space[1], columnGap: space[2] }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1], flexShrink: 1 }}>{extras}</View>
            {saldo && !sinDeuda ? (
              <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text, marginLeft: 'auto' }]}>{saldo}</Text>
            ) : null}
          </View>
        </View>
        {llamar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Llamar"
            accessibilityHint={direccion}
            onPress={llamar}
            style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Phone size={20} color={c.brandInk} />
          </Pressable>
        ) : null}
        {chevron ? (
          <View testID="fila-chevron" style={{ alignSelf: 'center' }}>
            <ChevronRight size={20} color={c.textSecondary} />
          </View>
        ) : null}
      </Pressable>
    )
  }

  return (
    <FilaDeSocio
      titulo={direccion}
      lineasTitulo={2}
      linea2={linea2}
      seleccionado={seleccionado}
      onPress={onPress}
      chevron={chevron}
      accessibilityLabel={accessibilityLabel}
      derecha={
        saldo && !sinDeuda ? (
          <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{saldo}</Text>
        ) : sinDeuda ? null : (
          <Lock size={16} color={c.textSecondary} accessibilityLabel={SALDO_RESERVADO} />
        )
      }
      extra={
        <>
          {/* "Sin deuda" va debajo y no junto al título: a 360dp le sacaba el lugar a la dirección. */}
          {sinDeuda ? secundario('Sin deuda') : null}
          {vendedor ? secundario(`Vendedor: ${vendedor}`) : null}
          <ChipAntiguedadDeuda dias={dias} />
          {vencido ? <StatusChip estado="anulado" label={`Vencido ${vencido}`} /> : null}
          {tagAjena}
        </>
      }
      accion={llamar ? { icono: Phone, label: 'Llamar', hint: direccion, onPress: llamar } : undefined}
    />
  )
}

import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronRight } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { formatToLocalTime } from '@/core/utils/fecha'
import type { RenglonDePago } from '../api/pagos'
import { NOMBRE_DEL_SENTIDO, sentidoDelPago } from '../lib/pago'
import { InsigniaDePago } from './InsigniaDePago'

interface Props {
  pago: RenglonDePago
  primera: boolean
  ultima: boolean
  onPress: () => void
}

/**
 * Un pago o cobro de la lista (web `pagos-client.tsx`): fecha, flecha de entrada o salida con su nombre, la entidad,
 * quién lo registró, el monto y los avisos ANULADO y "Sin movimiento de caja".
 */
export function FilaDePago({ pago: p, primera, ultima, onPress }: Props) {
  const c = useColors()
  const sentido = sentidoDelPago(p)
  const Flecha = sentido === 'neutro' ? ArrowRight : sentido === 'entra' ? ArrowDownLeft : ArrowUpRight
  const colorFlecha = sentido === 'neutro' ? c.textSecondary : sentido === 'entra' ? c.success : c.danger
  const monto = formatImporte(p.monto, { moneda: p.moneda })
  const entidad = p.socioRazonSocial?.trim() || '—'
  const fecha = formatToLocalTime(p.fecha)
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[NOMBRE_DEL_SENTIDO[sentido], entidad, monto, p.tipoNombre, fecha, p.estaAnulado && 'anulado'].filter(Boolean).join(', ')}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={{
        minHeight: 64,
        marginHorizontal: space[4],
        paddingVertical: space[3],
        paddingLeft: space[4],
        paddingRight: space[2],
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        overflow: 'hidden',
        backgroundColor: c.surface,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: c.surface2,
        ...(primera ? { borderTopLeftRadius: radii.tarjeta, borderTopRightRadius: radii.tarjeta } : null),
        ...(ultima ? { borderBottomLeftRadius: radii.tarjeta, borderBottomRightRadius: radii.tarjeta } : null),
      }}
    >
      <Flecha size={20} color={colorFlecha} />
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text numberOfLines={2} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{entidad}</Text>
        <Text style={secundario}>{`${p.tipoNombre} · ${fecha}`}</Text>
        {p.creadoPorNombre ? <Text style={secundario}>{`Registró ${p.creadoPorNombre}`}</Text> : null}
        {p.estaAnulado || p.sinMovimientoDeCaja ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
            {p.sinMovimientoDeCaja ? <InsigniaDePago texto="Sin movimiento de caja" /> : null}
            {p.estaAnulado ? <InsigniaDePago texto="ANULADO" /> : null}
          </View>
        ) : null}
      </View>
      <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{monto}</Text>
      <ChevronRight size={20} color={c.textSecondary} />
    </Pressable>
  )
}

import React, { memo } from 'react'
import { Text, View } from 'react-native'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronRight } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import { formatToLocalTime } from '@/core/utils/fecha'
import type { RenglonDePago } from '../api/pagos'
import { NOMBRE_DEL_SENTIDO, sentidoDelPago } from '../lib/pago'
import { InsigniaDePago } from './InsigniaDePago'

interface Props {
  pago: RenglonDePago
  onAbrir: (id: string) => void
}

/**
 * Un pago o cobro de la lista (web `pagos-client.tsx`): fecha, flecha de entrada o salida con su nombre, la entidad,
 * quién lo registró, el monto y los avisos ANULADO y "Sin movimiento de caja".
 */
export const FilaDePago = memo(function FilaDePago({ pago: p, onAbrir }: Props) {
  const c = useColors()
  const sentido = sentidoDelPago(p)
  const Flecha = sentido === 'neutro' ? ArrowRight : sentido === 'entra' ? ArrowDownLeft : ArrowUpRight
  // S5 (excepción aprobada): la flecha de Tesorería conserva verde/rojo; el sentido además va escrito en la etiqueta.
  const colorFlecha = sentido === 'neutro' ? c.text : sentido === 'entra' ? c.success : c.dangerFill
  const monto = formatImporte(p.monto, { moneda: p.moneda })
  const entidad = p.socioRazonSocial?.trim() || '—'
  const fecha = formatToLocalTime(p.fecha)
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <PressableFx
      accessibilityRole="button"
      accessibilityLabel={[NOMBRE_DEL_SENTIDO[sentido], entidad, monto, p.tipoNombre, fecha, p.estaAnulado && 'anulado'].filter(Boolean).join(', ')}
      onPress={() => onAbrir(p.id)}
      android_ripple={{ color: c.surface2 }}
      style={{
        minHeight: 76,
        marginHorizontal: space[4],
        marginBottom: space[2],
        paddingVertical: space[3],
        paddingLeft: space[3],
        paddingRight: space[3],
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[3],
        overflow: 'hidden',
        backgroundColor: c.surface,
        borderRadius: radii.fila,
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Flecha size={24} color={colorFlecha} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text numberOfLines={2} style={{ ...typeScale.textoFila, color: c.text }}>{entidad}</Text>
        <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{monto}</Text>
        <Text style={secundario}>{`${p.tipoNombre} · ${fecha}`}</Text>
        {p.creadoPorNombre ? <Text style={secundario}>{`Registró ${p.creadoPorNombre}`}</Text> : null}
        {p.estaAnulado || p.sinMovimientoDeCaja ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
            {p.sinMovimientoDeCaja ? <InsigniaDePago texto="Sin movimiento de caja" /> : null}
            {p.estaAnulado ? <InsigniaDePago texto="ANULADO" /> : null}
          </View>
        ) : null}
      </View>
      <ChevronRight size={20} color={c.text} />
    </PressableFx>
  )
})

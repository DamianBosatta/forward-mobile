import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { FONT, importe, radii, space, typeScale, useColors, useSombraTarjeta } from '@/libs/theme'
import { Button, Notice, StatusChip, TopBar, formatImporte } from '@/core/ui/fw'
import type { CobroRegistrado } from '../api/cobros'
import type { LineaDeRecibo } from '../lib/cobro'

export const PAGO_YA_ESTABA = 'Este pago ya estaba registrado: no se cargó de nuevo.'
export const PAGO_CON_LO_DE_ANTES =
  'Este pago ya se había registrado con los datos de antes. Los datos nuevos que cargaste NO se guardaron. Revisá el pago que quedó registrado: si tenía que ser distinto, pedí que lo anulen y registrá uno nuevo.'

interface Props {
  proveedor: string
  pago: CobroRegistrado
  lineas: LineaDeRecibo[]
  total: number
  onVolver: () => void
  onOtro: () => void
}

/**
 * "Pago registrado" (el lugar de "Cobro registrado" en el pago a un proveedor): la marca, el proveedor, el monto y los
 * medios, con los mismos avisos de reintento que el cobro (ya estaba, con los datos de antes, anulado). Sin recibo:
 * el comprobante del pago queda en la web.
 */
export function PagoRegistradoPantalla({ proveedor, pago, lineas, total, onVolver, onOtro }: Props) {
  const c = useColors()
  const sombra = useSombraTarjeta()
  const insets = useSafeAreaInsets()
  const titulo = pago.anulado ? 'Pago anulado' : pago.conLoDeAntes ? 'Pago ya registrado' : 'Pago registrado'
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const mostrarMonto = !pago.anulado && !pago.conLoDeAntes

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Pago registrado" />
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[6], gap: space[4] }}>
        <View style={{ padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, ...sombra, gap: space[2] }}>
          <View style={{ alignItems: 'center', gap: space[1], paddingBottom: space[2] }}>
            <View style={{ width: 56, height: 56, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={30} color={c.onAction} strokeWidth={2.5} />
            </View>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontFamily: FONT.semibold, fontWeight: '600', color: c.text, textAlign: 'center', marginTop: space[2] }}>{titulo}</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, textAlign: 'center' }}>{proveedor}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3], minHeight: 40 }}>
            <Text style={secundario}>Estado</Text>
            {pago.anulado ? <StatusChip estado="anulado" label="Anulado" /> : <StatusChip estado="entregado" label="Registrado" />}
          </View>
          {mostrarMonto ? (
            <>
              {lineas.map((l, i) => (
                <View key={i} accessible accessibilityLabel={`${l.medio}: ${formatImporte(l.monto)}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
                  <Text style={secundario}>{l.medio}</Text>
                  <Text style={[typeScale.cuerpo, importe, { color: c.text }]}>{formatImporte(l.monto)}</Text>
                </View>
              ))}
              <View accessible accessibilityLabel={`Pagado: ${formatImporte(total)}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[3] }}>
                <Text style={secundario}>Pagado</Text>
                <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(total)}</Text>
              </View>
            </>
          ) : null}
        </View>
        {pago.yaEstaba ? <Notice tone="advertencia">{PAGO_YA_ESTABA}</Notice> : null}
        {pago.conLoDeAntes ? <Notice tone="peligro">{PAGO_CON_LO_DE_ANTES}</Notice> : null}
        {pago.anulado ? <Notice tone="peligro">{pago.aviso ?? 'Este pago se registró con esta clave y después se anuló.'}</Notice> : null}
        <Button label="Volver" variant="secundario" onPress={onVolver} />
        <Button label="Registrar otro pago" variant="secundario" onPress={onOtro} />
      </ScrollView>
    </View>
  )
}

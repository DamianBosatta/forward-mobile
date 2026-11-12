import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, Share, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { FONT, importe, radii, space, typeScale, useColors, useSombraTarjeta } from '@/libs/theme'
import { Button, Notice, StatusChip, TopBar, TotalsRow, formatImporte } from '@/core/ui/fw'
import type { SocioDetailDto } from '@/libs/api-client/types'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { hoyTexto } from '@/core/utils/fecha'
import { useEstadoCuentaSocio } from '../api/queries'
import { useCuentaDelPago, useImputadoDelPago, type CobroRegistrado } from '../api/cobros'
import { textoImputacion } from '../lib/movimientos'
import { textoDeRecibo, type LineaDeRecibo } from '../lib/cobro'
import { COBRO_CON_LO_DE_ANTES, COBRO_YA_ESTABA, SIN_CUENTA_CONFIRMADA } from './CobroListo'

interface Props {
  cliente: SocioDetailDto
  cobro: CobroRegistrado
  monto: number
  medio: string
  lineas: LineaDeRecibo[]
  imputacionManual: boolean
  onVolver: () => void
  onOtro: () => void
}

/**
 * "Cobro registrado" del cobro en pasos (maqueta "Cobros como venta", frames 14 a 16; el lugar de "Venta guardada"):
 * la marca, en qué cuenta quedó según el servidor, el saldo nuevo y el recibo de texto. Mismas consultas y avisos
 * de reintento que `CobroListo` (que sigue en el formulario de siempre): el cobro que ya estaba, el que quedó con
 * los datos de antes y el anulado.
 */
export function CobroRegistradoPantalla({ cliente, cobro, monto, medio, lineas, imputacionManual, onVolver, onOtro }: Props) {
  const c = useColors()
  const sombra = useSombraTarjeta()
  const insets = useSafeAreaInsets()
  // Un cobro anulado ya no está en ninguna cuenta: no se busca dónde quedó.
  const { cuenta, buscando } = useCuentaDelPago(cobro.anulado ? { ...cobro, pagoId: null } : cobro, cliente)
  const imputado = useImputadoDelPago(cobro.anulado ? null : cobro.pagoId, cuenta, cliente)
  const textoImputado = textoImputacion(imputado.data)
  const estado = useEstadoCuentaSocio(cliente.id, !!cliente.puedeVerCuentaCorriente)
  const [falloRecibo, setFalloRecibo] = useState(false)
  const nombreCuenta = cuenta ? (cuenta === 'Tst' ? 'TST' : 'Normal') : null
  const titulo = cobro.anulado ? 'Cobro anulado' : cobro.conLoDeAntes ? 'Cobro ya registrado' : 'Cobro registrado'
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  const mandarRecibo = async () => {
    setFalloRecibo(false)
    try {
      const message = textoDeRecibo({
        cliente: `${nombreDelCliente(cliente)} (${direccionDeEntrega(cliente)})`,
        fecha: hoyTexto(),
        total: monto,
        lineas: lineas.length ? lineas : [{ medio: medio || 'Cobro', monto }],
        cuenta: nombreCuenta,
      })
      await Share.share({ message })
    } catch {
      setFalloRecibo(true)
    }
  }

  const fila = (k: string, v: React.ReactNode, ultima = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3], minHeight: 40, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: c.border }}>
      <Text style={secundario}>{k}</Text>
      {v}
    </View>
  )
  // El monto y el medio del formulario no son los del cobro que quedó grabado con lo de antes.
  const mostrarMonto = !cobro.anulado && !cobro.conLoDeAntes

  return (
    <View style={{ flex: 1 }}>
      {/* La barra dice siempre "Cobro registrado" (maqueta, frames 14 a 16); la tarjeta dice cómo quedó. */}
      <TopBar title="Cobro registrado" />
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[6], gap: space[4] }}>
        <View style={{ padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, ...sombra, gap: space[2] }}>
          <View style={{ alignItems: 'center', gap: space[1], paddingBottom: space[2] }}>
            <View style={{ width: 56, height: 56, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={30} color={c.onAction} strokeWidth={2.5} />
            </View>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontFamily: FONT.semibold, fontWeight: '600', color: c.text, textAlign: 'center', marginTop: space[2] }}>{titulo}</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, textAlign: 'center' }}>{direccionDeEntrega(cliente)}</Text>
            <Text style={{ ...secundario, textAlign: 'center' }}>{nombreDelCliente(cliente)}</Text>
          </View>
          {fila('Estado', cobro.anulado ? <StatusChip estado="anulado" label="Anulado" /> : <StatusChip estado="entregado" label="Registrado" />)}
          {cobro.anulado ? null : fila('Cuenta', buscando ? <ActivityIndicator color={c.brandInk} /> : <Text style={{ ...typeScale.cuerpo, color: c.text }}>{nombreCuenta ? `Quedó en la cuenta ${nombreCuenta}` : '—'}</Text>, !mostrarMonto)}
          {mostrarMonto ? fila('Cobrado', <Text style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(monto)}</Text>, true) : null}
          {mostrarMonto && medio ? <Text style={secundario}>{medio}</Text> : null}
        </View>
        {cuenta && !cobro.anulado ? (
          <Text style={secundario}>
            {imputacionManual && !cobro.conLoDeAntes ? 'La de los comprobantes que elegiste.' : 'La eligió el servidor: la cuenta de la deuda más vieja del cliente (sin deuda, la TST).'}
          </Text>
        ) : null}
        {textoImputado && !cobro.anulado ? <Text style={{ ...typeScale.cuerpo, color: c.text }}>{textoImputado}</Text> : null}
        {cobro.yaEstaba ? <Notice tone="advertencia">{COBRO_YA_ESTABA}</Notice> : null}
        {cobro.conLoDeAntes ? <Notice tone="peligro">{COBRO_CON_LO_DE_ANTES}</Notice> : null}
        {cobro.anulado ? <Notice tone="peligro">{cobro.aviso ?? 'Este cobro se registró con esta clave y después se anuló.'}</Notice> : null}
        {!cobro.anulado && !buscando && !cuenta ? <Notice tone="advertencia">{SIN_CUENTA_CONFIRMADA}</Notice> : null}

        {estado.data ? (
          <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, ...sombra, padding: space[4], gap: space[2] }}>
            <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Saldo nuevo</Text>
            <TotalsRow label="Cuenta TST" importe={estado.data.saldoTst} />
            <TotalsRow label="Cuenta Normal" importe={estado.data.saldoNormal} />
            <TotalsRow label="Saldo" importe={estado.data.saldoActual} destacado />
          </View>
        ) : null}

        {cobro.anulado || cobro.conLoDeAntes ? null : <Button label="Mandar recibo" onPress={mandarRecibo} />}
        {falloRecibo ? <Notice tone="peligro">No se pudo abrir el menú de compartir. Probá de nuevo.</Notice> : null}
        <Button label="Volver a la cuenta corriente" variant="secundario" onPress={onVolver} />
        <Button label="Registrar otro cobro" variant="secundario" onPress={onOtro} />
      </ScrollView>
    </View>
  )
}

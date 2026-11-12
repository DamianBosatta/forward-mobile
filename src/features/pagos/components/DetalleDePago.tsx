import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TopBar, formatImporte, useInsetInferior } from '@/core/ui/fw'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { formatToLocalTime } from '@/core/utils/fecha'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { usePago } from '../api/pagos'
import { usePuedeVerPagos } from '../lib/permiso'
import { InsigniaDePago } from './InsigniaDePago'

/**
 * Detalle de un pago o cobro (`GET /Pagos/{id}`): socio, monto, medio, fechas, quién lo registró, a qué comprobantes se
 * imputó y con qué movimientos se concilió. Solo lectura: anular y el comprobante quedan en la web.
 */
export function DetalleDePago({ id, onVolver }: { id: string; onVolver: () => void }) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const puedeVer = usePuedeVerPagos()
  const q = usePago(id, puedeVer)
  const p = q.data
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const tarjeta = { gap: space[2], backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, padding: space[4] }
  const fila = (label: string, valor: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
      <Text style={secundario}>{label}</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.text, flexShrink: 1, textAlign: 'right' }}>{valor}</Text>
    </View>
  )
  const monto = (label: string, n: number, moneda?: string | null) => (
    <View key={label} accessible accessibilityLabel={`${label}: ${formatImporte(n, { moneda })}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
      <Text style={{ ...typeScale.cuerpo, color: c.text, flexShrink: 1 }}>{label}</Text>
      <Text style={[typeScale.cuerpo, importe, { color: c.text }]}>{formatImporte(n, { moneda })}</Text>
    </View>
  )

  let cuerpo: React.ReactNode
  if (!puedeVer) cuerpo = <EstadoDePantalla tipo="sinPermiso" titulo="No podés ver los pagos" />
  else if (q.isLoading) cuerpo = <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  else if (!p) {
    cuerpo = esFallaDeRed(q.error) ? (
      <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar el pago" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
    ) : (
      <View style={{ padding: space[4], gap: space[2] }}>
        <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudo cargar el pago.')}</Notice>
        <Button label="Reintentar" variant="secundario" onPress={() => void q.refetch()} />
      </View>
    )
  } else {
    cuerpo = (
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[4] + insetInferior }}>
        <FormContainer style={{ gap: space[4] }}>
          <View style={tarjeta}>
            <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{p.razonSocialSocio?.trim() || '—'}</Text>
            {!p.activo ? <InsigniaDePago texto="ANULADO" /> : null}
            <View accessible accessibilityLabel={`Monto: ${formatImporte(p.montoAmount, { moneda: p.montoMoneda })}`}>
              <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(p.montoAmount, { moneda: p.montoMoneda })}</Text>
            </View>
            {fila('Medio', p.medioPago)}
            {p.tipoSocio ? fila('Socio', p.tipoSocio) : null}
            {fila('Fecha', formatToLocalTime(p.fecha))}
            {p.fechaOperacion && p.fechaOperacion !== p.fecha ? fila('Operación', formatToLocalTime(p.fechaOperacion)) : null}
            {p.creadoPorNombre ? <Text style={secundario}>{`Registró ${p.creadoPorNombre}`}</Text> : null}
          </View>
          <View style={tarjeta}>
            <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Se aplicó a</Text>
            {p.imputaciones?.length ? p.imputaciones.map(i => monto(i.codigoVenta, i.montoAmount, i.montoMoneda)) : (
              <Text style={secundario}>Sin comprobantes imputados.</Text>
            )}
          </View>
          {p.conciliaciones?.length ? (
            <View style={tarjeta}>
              <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Conciliado con</Text>
              {p.conciliaciones.map(k => monto(k.referenciaMovimiento, k.montoAplicadoAmount, k.montoAplicadoMoneda))}
            </View>
          ) : null}
        </FormContainer>
      </ScrollView>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Detalle del pago" leading={{ kind: 'atras', onPress: onVolver }} />
      {cuerpo}
    </View>
  )
}

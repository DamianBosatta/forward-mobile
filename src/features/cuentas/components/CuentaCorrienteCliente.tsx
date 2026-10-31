import React, { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useRouter } from 'expo-router'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { Button, Notice, Segmented, TopBar, TotalsRow, formatImporte } from '@/core/ui/fw'
import { MOTIVO_SIN_PERMISO_DE_COBRO, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useResponsive } from '@/libs/useResponsive'
import { useSocio } from '@/libs/api-client/socios'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { formatToLocalTime } from '@/src/utils/date'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { CreditoDelCliente } from '@/features/clientes/components/CreditoDelCliente'
import { useEstadoCuentaSocio } from '../api/queries'
import { useMovimientosDeCliente } from '../hooks/useMovimientosDeCliente'
import { PERIODOS_DE_CUENTA, rangoDelPeriodo, type PeriodoDeCuenta } from '../lib/periodo'
import { NOMBRE_CUENTA, descripcionDe, textoImputacion, textoVencimiento, type FiltroCuenta, type MovimientoConCuenta } from '../lib/movimientos'

/** Cuánto antes del final de la lista se pide la página siguiente. */
const DISTANCIA_PARA_CARGAR_MAS = 400

export const AVISO_CADA_COBRO =
  'Cada cobro queda en la cuenta de la deuda más vieja, salvo que elijas a qué comprobantes imputarlo. En cada movimiento ves en qué cuenta quedó.'

const FILTROS = [
  { value: 'ambas' as const, label: 'Las dos' },
  { value: 'Tst' as const, label: 'TST' },
  { value: 'Normal' as const, label: 'Normal' },
]

function Tarjeta({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      {titulo ? <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{titulo}</Text> : null}
      {children}
    </View>
  )
}

function Movimiento({ m, tabla }: { m: MovimientoConCuenta; tabla?: boolean }) {
  const c = useColors()
  const fecha = formatToLocalTime(m.fecha, 'EEE d MMM')
  const esDebe = m.debe > 0
  const monto = esDebe ? `+ ${formatImporte(m.debe)}` : `− ${formatImporte(m.haber)}`
  const saldo = `Saldo ${formatImporte(m.saldoHistorico)}`
  const detalle = m.medioPagoNombre?.trim()
  const descripcion = descripcionDe(m)
  const vence = textoVencimiento(m.vencimiento)
  const imputado = textoImputacion(m.imputadoA)
  return (
    <View
      accessible
      accessibilityLabel={[fecha, NOMBRE_CUENTA[m.cuenta], descripcion, detalle, vence, imputado, monto, saldo].filter(Boolean).join(', ')}
      style={{ flexDirection: 'row', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4], backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      {/* Teléfono: día/mes a la izquierda. Tablet (TabCuentas): tabla Fecha / Movimiento / Vence / Importe. */}
      <Text style={{ ...typeScale.secundario, color: c.textSecondary, width: tabla ? 96 : 44 }}>{tabla ? fecha : formatToLocalTime(m.fecha, 'dd/MM')}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{descripcion}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{NOMBRE_CUENTA[m.cuenta]}</Text>
        {detalle ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{detalle}</Text> : null}
        {tabla ? null : vence ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{vence}</Text> : null}
        {imputado ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{imputado}</Text> : null}
      </View>
      {tabla ? <Text style={{ ...typeScale.secundario, color: c.textSecondary, width: 120 }}>{vence ?? '—'}</Text> : null}
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        {/* El signo va siempre con el color: lo cobrado en verde, lo que se debe en el color base. */}
        <Text style={[typeScale.cuerpoDestacado, importe, { color: esDebe ? c.text : c.chip.entregado.text }]}>{monto}</Text>
        <Text style={[typeScale.secundario, importe, { color: c.textSecondary }]}>{saldo}</Text>
      </View>
    </View>
  )
}

/**
 * Cuenta corriente de un cliente (láminas CuentaCorriente y TabCuentaCorriente): saldo con el
 * desglose TST / Normal que da el servidor y los movimientos de las dos cuentas. Qué se puede ver
 * lo decide el servidor (`puedeVerCuentaCorriente` y los permisos de cada endpoint). Con `onRegistrarCobro` (tablet)
 * el cobro se abre en el panel y no en otra pantalla.
 */
export function CuentaCorrienteCliente({ socioId, onRegistrarCobro, conBarra = false }: { socioId: string; onRegistrarCobro?: () => void; conBarra?: boolean }) {
  const c = useColors()
  const router = useRouter()
  const { canCreate, canRead } = usePermissions()
  const { isTabletLandscape } = useResponsive()
  const [filtro, setFiltro] = useState<FiltroCuenta>('ambas')
  // Período elegido (null = todo el historial). El rango se fija al elegirlo: no se mueve con el reloj mientras se mira.
  const [periodo, setPeriodo] = useState<PeriodoDeCuenta | null>(null)
  const rango = useMemo(() => (periodo ? rangoDelPeriodo(periodo, Date.now()) : undefined), [periodo])
  const socio = useSocio(socioId)
  const verCuenta = !!socio.data?.puedeVerCuentaCorriente
  const estado = useEstadoCuentaSocio(socioId, verCuenta)
  const movs = useMovimientosDeCliente(socioId, verCuenta ? socio.data ?? {} : {}, filtro, verCuenta, rango)

  // Con el servidor nuevo la lista se completa sola al llegar cerca del final.
  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!movs.conServidorNuevo || !movs.hayMas) return
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - DISTANCIA_PARA_CARGAR_MAS) movs.cargarMas()
  }

  const barraSimple = conBarra ? <TopBar title="Cuenta corriente" leading={{ kind: 'atras', onPress: () => router.back() }} /> : null
  if (socio.isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {barraSimple}
        <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
      </View>
    )
  }
  if (socio.error || !socio.data) {
    return (
      <View style={{ flex: 1 }}>
        {barraSimple}
        <View style={{ padding: space[4] }}>
          <Notice tone="peligro">{mensajeDelServidor(socio.error, 'No se pudo abrir el cliente.')}</Notice>
        </View>
      </View>
    )
  }
  const cliente = socio.data
  const nombre = nombreDelCliente(cliente)
  const e = estado.data

  // La pantalla de cobro pide los medios y las cajas abiertas: MOD_PAGOS:Read además de Create. Como en la web, el
  // botón no desaparece: sin permiso se ve deshabilitado y dice por qué.
  const puedeCobrar = canCreate('MOD_PAGOS') && canRead('MOD_PAGOS')
  const registrarCobro = (
    <View style={{ gap: space[2] }}>
      <Button
        label="Cobrar"
        disabled={!puedeCobrar}
        onPress={() => (onRegistrarCobro ? onRegistrarCobro() : router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId } }))}
      />
      {!puedeCobrar ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_COBRO}</MotivoDeshabilitado> : null}
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
    {conBarra ? <TopBar title="Cuenta corriente" leading={{ kind: 'atras', onPress: () => router.back() }} /> : null}
    <ScrollView testID="cuenta-corriente-scroll" onScroll={alDesplazar} scrollEventThrottle={200} contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      {/* La dirección va en el cuerpo, en las líneas que necesite: en la barra se cortaba a 360dp. */}
      {(
        <View style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccionDeEntrega(cliente)}</Text>
          {nombre ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombre}</Text> : null}
        </View>
      )}
      {verCuenta && isTabletLandscape ? registrarCobro : null}

      {!verCuenta ? <Notice tone="info">No tenés acceso a la cuenta corriente de este cliente.</Notice> : null}

      {verCuenta ? (
        <Tarjeta>
          {estado.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
          {estado.error ? <Notice tone="peligro">{mensajeDelServidor(estado.error, 'No se pudo cargar la cuenta.')}</Notice> : null}
          {e ? (
            <>
              <View accessible accessibilityLabel={`Saldo: ${formatImporte(e.saldoActual)}`} style={{ gap: space[1] }}>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Saldo</Text>
                <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(e.saldoActual)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: space[4] }}>
                <View accessible accessibilityLabel={`Cuenta TST: ${formatImporte(e.saldoTst)}`} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>TST</Text>
                  <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(e.saldoTst)}</Text>
                </View>
                <View accessible accessibilityLabel={`Cuenta Normal (con factura): ${formatImporte(e.saldoNormal)}`} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Normal (con factura)</Text>
                  <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(e.saldoNormal)}</Text>
                </View>
              </View>
              {e.saldoAFavor > 0 ? <TotalsRow label="A favor" importe={e.saldoAFavor} /> : null}
              {cliente.topeCredito != null ? <TotalsRow label="Tope de crédito" importe={cliente.topeCredito} /> : null}
              <CreditoDelCliente estado={e} />
            </>
          ) : null}
        </Tarjeta>
      ) : null}

      {verCuenta ? <Notice tone="info">{AVISO_CADA_COBRO}</Notice> : null}

      {verCuenta ? (
        <View style={{ gap: space[3] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Movimientos</Text>
          <Segmented options={FILTROS} value={filtro} onChange={setFiltro} accessibilityLabel="Cuenta" />
          <View accessibilityRole="radiogroup" accessibilityLabel="Período" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {PERIODOS_DE_CUENTA.map(p => (
              <FiltroChip key={p.valor} label={p.label} activo={periodo === p.valor} onPress={() => setPeriodo(periodo === p.valor ? null : p.valor)} />
            ))}
          </View>
          {/* TODO API: "Saldo al 01/10" inicial y PDF del estado. */}
          {movs.cargando ? <ActivityIndicator color={c.brandInk} /> : null}
          {movs.error ? <Notice tone="peligro">{mensajeDelServidor(movs.error, 'No se pudieron cargar los movimientos.')}</Notice> : null}
          {!movs.cargando && !movs.error && movs.movimientos.length === 0 ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{periodo ? 'No hay movimientos en este período.' : 'No hay movimientos en esta cuenta.'}</Text>
          ) : null}
          {movs.movimientos.map(m => <Movimiento key={`${m.cuenta}-${m.id}`} m={m} tabla={isTabletLandscape} />)}
          {movs.errorPaginaSiguiente ? (
            <>
              <Notice tone="peligro">{mensajeDelServidor(movs.errorPaginaSiguiente, 'No se pudieron cargar los movimientos anteriores.')}</Notice>
              <Button label="Reintentar" variant="secundario" loading={movs.cargandoMas} onPress={movs.reintentar} />
            </>
          ) : movs.hayMas ? (
            <Button label="Ver movimientos anteriores" variant="secundario" loading={movs.cargandoMas} onPress={movs.cargarMas} />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
    {verCuenta && !isTabletLandscape ? (
      <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>{registrarCobro}</View>
    ) : null}
    </View>
  )
}

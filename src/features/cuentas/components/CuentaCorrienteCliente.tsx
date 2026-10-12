import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, Segmented, TotalsRow, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { formatToLocalTime } from '@/src/utils/date'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { CreditoDelCliente } from '@/features/clientes/components/CreditoDelCliente'
import { useEstadoCuentaSocio } from '../api/queries'
import { useMovimientosDeCliente } from '../hooks/useMovimientosDeCliente'
import { NOMBRE_CUENTA, type FiltroCuenta, type MovimientoConCuenta } from '../lib/movimientos'

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

function Movimiento({ m }: { m: MovimientoConCuenta }) {
  const c = useColors()
  const fecha = formatToLocalTime(m.fecha, 'EEE d MMM')
  const monto = m.debe > 0 ? `+ ${formatImporte(m.debe)}` : `− ${formatImporte(m.haber)}`
  const saldo = `Saldo ${formatImporte(m.saldoHistorico)}`
  const detalle = m.medioPagoNombre?.trim()
  return (
    <View
      accessible
      accessibilityLabel={[fecha, NOMBRE_CUENTA[m.cuenta], m.referencia, detalle, monto, saldo].filter(Boolean).join(', ')}
      style={{ flexDirection: 'row', gap: space[3], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: c.border }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${fecha} · ${NOMBRE_CUENTA[m.cuenta]}`}</Text>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{m.referencia}</Text>
        {detalle ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{detalle}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{monto}</Text>
        <Text style={[typeScale.secundario, importe, { color: c.textSecondary }]}>{saldo}</Text>
      </View>
    </View>
  )
}

/**
 * Cuenta corriente de un cliente (láminas CuentaCorriente y TabCuentaCorriente): saldo con el
 * desglose TST / Normal que da el servidor y los movimientos de las dos cuentas. Qué se puede ver
 * lo decide el servidor (`puedeVerCuentaCorriente` y los permisos de cada endpoint).
 */
export function CuentaCorrienteCliente({ socioId }: { socioId: string }) {
  const c = useColors()
  const router = useRouter()
  const { canCreate, canRead } = usePermissions()
  const [filtro, setFiltro] = useState<FiltroCuenta>('ambas')
  const socio = useSocio(socioId)
  const verCuenta = !!socio.data?.puedeVerCuentaCorriente
  const estado = useEstadoCuentaSocio(socioId, verCuenta)
  const movs = useMovimientosDeCliente(verCuenta ? socio.data ?? {} : {}, filtro)

  if (socio.isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (socio.error || !socio.data) {
    return (
      <View style={{ padding: space[4] }}>
        <Notice tone="peligro">{mensajeDelServidor(socio.error, 'No se pudo abrir el cliente.')}</Notice>
      </View>
    )
  }
  const cliente = socio.data
  const nombre = nombreDelCliente(cliente)
  const e = estado.data

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccionDeEntrega(cliente)}</Text>
        {nombre ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombre}</Text> : null}
      </View>

      {!verCuenta ? <Notice tone="info">No tenés acceso a la cuenta corriente de este cliente.</Notice> : null}

      {verCuenta ? (
        <Tarjeta>
          {estado.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
          {estado.error ? <Notice tone="peligro">{mensajeDelServidor(estado.error, 'No se pudo cargar la cuenta.')}</Notice> : null}
          {e ? (
            <>
              <TotalsRow label="Saldo" importe={e.saldoActual} destacado />
              <TotalsRow label="Cuenta TST" importe={e.saldoTst} />
              <TotalsRow label="Cuenta Normal (con factura)" importe={e.saldoNormal} />
              {e.saldoAFavor > 0 ? <TotalsRow label="A favor" importe={e.saldoAFavor} /> : null}
              {cliente.topeCredito != null ? <TotalsRow label="Tope de crédito" importe={cliente.topeCredito} /> : null}
              <CreditoDelCliente estado={e} />
            </>
          ) : null}
          {/* La pantalla de cobro pide los medios y las cajas abiertas: MOD_PAGOS:Read además de Create. */}
          {canCreate('MOD_PAGOS') && canRead('MOD_PAGOS') ? (
            <Button label="Registrar cobro" onPress={() => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId } })} />
          ) : null}
        </Tarjeta>
      ) : null}

      {verCuenta ? <Notice tone="info">{AVISO_CADA_COBRO}</Notice> : null}

      {verCuenta ? (
        <Tarjeta titulo="Movimientos">
          <Segmented options={FILTROS} value={filtro} onChange={setFiltro} accessibilityLabel="Cuenta" />
          {movs.cargando ? <ActivityIndicator color={c.brandInk} /> : null}
          {movs.error ? <Notice tone="peligro">{mensajeDelServidor(movs.error, 'No se pudieron cargar los movimientos.')}</Notice> : null}
          {!movs.cargando && !movs.error && movs.movimientos.length === 0 ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>No hay movimientos en esta cuenta.</Text>
          ) : null}
          {movs.movimientos.map(m => <Movimiento key={`${m.cuenta}-${m.id}`} m={m} />)}
          {movs.hayMas ? (
            <Button label="Ver movimientos anteriores" variant="secundario" loading={movs.cargandoMas} onPress={movs.cargarMas} />
          ) : null}
        </Tarjeta>
      ) : null}
    </ScrollView>
  )
}

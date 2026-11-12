import React, { useMemo, useState } from 'react'
import { ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useRouter } from 'expo-router'
import { FileText, HandCoins } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { Button, Notice, Segmented, TopBar, TotalsRow, formatImporte, useInsetInferior } from '@/core/ui/fw'
import { MOTIVO_SIN_PERMISO_DE_COBRO, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useResponsive } from '@/libs/useResponsive'
import { useSocio } from '@/libs/api-client/socios'
import { usePuedeCobrar } from '../lib/permiso'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { formatToLocalTime } from '@/core/utils/fecha'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { AVISO_DEUDA_VENCIDA, CreditoDelCliente } from '@/features/clientes/components/CreditoDelCliente'
import { HeroSaldo, SaldosPorCuenta } from '@/features/clientes/components/SaldoDelCliente'
import { Esqueletos, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { useEstadoCuentaSocio } from '../api/queries'
import { HojaEstadoDeCuenta } from '@/features/deudores/components/HojaEstadoDeCuenta'
import { usePuedeExportarEstadoDeCuenta } from '@/features/deudores/lib/permiso'
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

/** Los datos de un movimiento en una sola línea ("Cuenta TST · Efectivo · Imputado a A00401"), cada parte con su texto. */
function LineaDeDetalle({ partes }: { partes: string[] }) {
  const c = useColors()
  return (
    <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
      {partes.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 ? ' · ' : null}
          <Text>{p}</Text>
        </React.Fragment>
      ))}
    </Text>
  )
}

/**
 * Un movimiento como una línea del carrito de la venta (propuesta "Clientes como venta", frame 13): la fecha en
 * pastilla, el detalle en una línea, el importe y el saldo a la derecha (lo cobrado en verde con "−").
 */
function Movimiento({ m, tabla, ultimo }: { m: MovimientoConCuenta; tabla?: boolean; ultimo?: boolean }) {
  const c = useColors()
  const fecha = formatToLocalTime(m.fecha, 'EEE d MMM')
  const esDebe = m.debe > 0
  const monto = esDebe ? `+ ${formatImporte(m.debe)}` : `− ${formatImporte(m.haber)}`
  const saldo = `Saldo ${formatImporte(m.saldoHistorico)}`
  const detalle = m.medioPagoNombre?.trim()
  const descripcion = descripcionDe(m)
  const vence = textoVencimiento(m.vencimiento)
  const imputado = textoImputacion(m.imputadoA)
  const partes = [NOMBRE_CUENTA[m.cuenta], detalle, tabla ? null : vence, imputado].filter((p): p is string => Boolean(p))
  return (
    <View
      accessible
      accessibilityLabel={[fecha, NOMBRE_CUENTA[m.cuenta], descripcion, detalle, vence, imputado, monto, saldo].filter(Boolean).join(', ')}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4], backgroundColor: c.surface, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: c.surface2 }}
    >
      {/* Teléfono: día/mes en pastilla. Tablet (TabCuentas): tabla Fecha / Movimiento / Vence / Importe. */}
      {tabla ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary, width: 96 }}>{fecha}</Text>
      ) : (
        <View testID="fecha-movimiento" style={{ backgroundColor: c.surface2, borderRadius: radii.campo, paddingVertical: 2, paddingHorizontal: space[2] }}>
          <Text style={[typeScale.etiqueta, importe, { color: c.text }]}>{formatToLocalTime(m.fecha, 'dd/MM')}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{descripcion}</Text>
        <LineaDeDetalle partes={partes} />
      </View>
      {tabla ? <Text style={{ ...typeScale.secundario, color: c.textSecondary, width: 120 }}>{vence ?? '—'}</Text> : null}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
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
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const puedeCobrar = usePuedeCobrar()
  const puedeExportar = usePuedeExportarEstadoDeCuenta()
  const [compartiendo, setCompartiendo] = useState(false)
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
        <View style={{ padding: space[4] }}>
          <Esqueletos bloques={FILAS_CARGANDO} />
        </View>
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
  // Misma condición que `CreditoDelCliente`: lo vencido solo se dice si el servidor lo informa con importe.
  const vencida = e?.tieneDeudaVencida === true && typeof e.deudaVencida === 'number'

  // La pantalla de cobro pide los medios y las cajas abiertas: MOD_PAGOS:Read además de Create. Como en la web, el
  // botón no desaparece: sin permiso se ve deshabilitado y dice por qué.
  const registrarCobro = (
    <View style={{ gap: space[2] }}>
      <Button
        label="Cobrar"
        icon={HandCoins}
        disabled={!puedeCobrar}
        onPress={() => (onRegistrarCobro ? onRegistrarCobro() : router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId } }))}
      />
      {!puedeCobrar ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_COBRO}</MotivoDeshabilitado> : null}
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
    {conBarra ? <TopBar lineasMultiples title={direccionDeEntrega(cliente)} subtitle={nombre ? `Cuenta corriente · ${nombre}` : 'Cuenta corriente'} leading={{ kind: 'atras', onPress: () => router.back() }} /> : null}
    <ScrollView testID="cuenta-corriente-scroll" onScroll={alDesplazar} scrollEventThrottle={200} contentContainerStyle={{ padding: space[4], paddingBottom: space[4] + insetInferior, gap: space[4] }}>
      {!conBarra ? (
        <View style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccionDeEntrega(cliente)}</Text>
          {nombre ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombre}</Text> : null}
        </View>
      ) : null}
      {verCuenta && isTabletLandscape ? registrarCobro : null}

      {!verCuenta ? <Notice tone="info">No tenés acceso a la cuenta corriente de este cliente.</Notice> : null}

      {verCuenta ? (
        <>
          {estado.isLoading ? <Esqueletos bloques={[{ alto: 180, radio: radii.hoja, testID: 'esqueleto-hero' }]} /> : null}
          {estado.error ? <Notice tone="peligro">{mensajeDelServidor(estado.error, 'No se pudo cargar la cuenta.')}</Notice> : null}
          {e ? (
            <>
              <HeroSaldo
                saldo={e.saldoActual}
                vencido={vencida ? e.deudaVencida : null}
                diasDeudaMasVieja={cliente.diasDeudaMasVieja}
                tope={cliente.topeCredito != null && cliente.topeCredito > 0 ? cliente.topeCredito : null}
                disponible={typeof e.creditoDisponible === 'number' ? e.creditoDisponible : null}
                accessibilityLabel={`Saldo: ${formatImporte(e.saldoActual)}`}
              />
              <SaldosPorCuenta tst={e.saldoTst} normal={e.saldoNormal} />
              {/* El resto como los totales del carrito (frame 13). */}
              {cliente.topeCredito != null || e.saldoAFavor > 0 || vencida || typeof e.creditoDisponible === 'number' ? (
                <Tarjeta>
                  {cliente.topeCredito != null ? <TotalsRow label="Tope de crédito" importe={cliente.topeCredito} /> : null}
                  <CreditoDelCliente estado={e} sinAviso />
                  {e.saldoAFavor > 0 ? <TotalsRow label="A favor" importe={e.saldoAFavor} /> : null}
                </Tarjeta>
              ) : null}
              {vencida ? <Notice tone="advertencia">{AVISO_DEUDA_VENCIDA}</Notice> : null}
            </>
          ) : null}
        </>
      ) : null}

      {verCuenta ? <Notice tone="info">{AVISO_CADA_COBRO}</Notice> : null}

      {verCuenta ? (
        <View style={{ gap: space[3] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Movimientos</Text>
          {/* S2: el estado de cuenta en PDF o Excel para mandárselo al cliente (MOD_CC o MOD_CLIENTES, como el export). */}
          {puedeExportar ? <Button label="Estado de cuenta" icon={FileText} variant="secundario" onPress={() => setCompartiendo(true)} /> : null}
          <Segmented options={FILTROS} value={filtro} onChange={setFiltro} accessibilityLabel="Cuenta" />
          <View accessibilityRole="radiogroup" accessibilityLabel="Período" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {PERIODOS_DE_CUENTA.map(p => (
              <FiltroChip key={p.valor} label={p.label} activo={periodo === p.valor} onPress={() => setPeriodo(periodo === p.valor ? null : p.valor)} />
            ))}
          </View>
          {/* TODO API: "Saldo al 01/10" inicial. */}
          {movs.cargando ? <Esqueletos bloques={FILAS_CARGANDO} /> : null}
          {movs.error ? <Notice tone="peligro">{mensajeDelServidor(movs.error, 'No se pudieron cargar los movimientos.')}</Notice> : null}
          {!movs.cargando && !movs.error && movs.movimientos.length === 0 ? (
            <Tarjeta>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{periodo ? 'No hay movimientos en este período.' : 'No hay movimientos en esta cuenta.'}</Text>
            </Tarjeta>
          ) : null}
          {movs.movimientos.length > 0 ? (
            <View testID="lista-movimientos" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, overflow: 'hidden' }}>
              {movs.movimientos.map((m, i) => (
                <Movimiento key={`${m.cuenta}-${m.id}`} m={m} tabla={isTabletLandscape} ultimo={i === movs.movimientos.length - 1} />
              ))}
            </View>
          ) : null}
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
      // Pie del carrito (frame 13): el saldo a la izquierda y "Cobrar" como botón principal.
      <View testID="pie-cuenta" style={{ padding: space[4], gap: space[2], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
        {e ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Saldo</Text>
            <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(e.saldoActual)}</Text>
          </View>
        ) : null}
        {registrarCobro}
      </View>
    ) : null}
    {verCuenta && puedeExportar ? (
      <HojaEstadoDeCuenta socio={compartiendo ? { id: socioId, razonSocial: cliente.razonSocial } : null} onClose={() => setCompartiendo(false)} />
    ) : null}
    </View>
  )
}

import React, { useState } from 'react'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, FiltroChip, Notice, StatusChip, TopBar, TotalsRow, TwoPane, formatImporte, useMenuLeading, useInsetInferior } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { usePendientesAutorizacion, type VentaPendienteAutorizacion } from '@/libs/api-client/ventas'
import { useAuthStore } from '@/libs/store/auth.store'
import { formatRelativeTime } from '@/core/utils/fecha'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { filtrosConConteo, motivosDe, pideRazon, tieneMotivo, type ClaveMotivo } from '../lib/motivos'
import { DecisionSheet, type Decision } from './DecisionSheet'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { HeroSaldo } from '@/features/clientes/components/SaldoDelCliente'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'

/** Total de la bandeja: solo si todas las ventas son de la misma moneda; si no, no hay una cifra honesta. */
export function totalDeBandeja(lista: VentaPendienteAutorizacion[]): number | null {
  if (lista.length === 0) return null
  const moneda = lista[0]!.totalCurrency
  if (lista.some((v) => v.totalCurrency !== moneda)) return null
  return lista.reduce((s, v) => s + v.totalAmount, 0)
}

/**
 * Hero "Por autorizar" (propuesta "Finanzas como venta", frame 16): la cifra es el total solo si todas son de la
 * misma moneda; si no, la cantidad. Debajo, la cantidad y la más antigua: todo sale de la misma bandeja.
 */
export function heroDeBandeja(lista: VentaPendienteAutorizacion[]): { cifra: string; meta: string } | null {
  if (lista.length === 0) return null
  const total = totalDeBandeja(lista)
  const masAntigua = lista.reduce((a, v) => (new Date(v.fechaPendiente).getTime() < new Date(a.fechaPendiente).getTime() ? v : a))
  const ventas = lista.length === 1 ? 'venta' : 'ventas'
  const antigua = `la más antigua, ${formatRelativeTime(masAntigua.fechaPendiente)}`
  return total !== null
    ? { cifra: formatImporte(total), meta: `${lista.length} ${ventas} · ${antigua}` }
    : { cifra: String(lista.length), meta: `${ventas} · ${antigua}` }
}

/** Esqueletos de la bandeja cargando (frame 18): el hero y una tarjeta. */
const BANDEJA_CARGANDO = [{ alto: 116, radio: 24, testID: 'esqueleto-hero' }, { alto: 180, testID: 'esqueleto-tarjeta' }]

/**
 * Dirección como título y el nombre (fantasía · razón social, sin repetir) aparte, como la lámina.
 * Llegan por separado desde forward-system #884; un servidor anterior solo manda el nombre compuesto.
 */
export function clienteDeBandeja(v: VentaPendienteAutorizacion): { titulo: string; nombre: string | null } {
  const direccion = v.direccionCliente?.trim()
  const nombres = [...new Set([v.nombreFantasiaCliente?.trim(), v.razonSocialCliente?.trim()].filter((n): n is string => !!n))]
  if (direccion) return { titulo: direccion, nombre: nombres.join(' · ') || null }
  if (!nombres.length) return { titulo: v.clienteDisplayName, nombre: null }
  return { titulo: nombres[0]!, nombre: nombres.slice(1).join(' · ') || null }
}

interface Props {
  /** Detalle embebido para el panel derecho en tablet horizontal. */
  detalle: (id: string, cerrar: () => void) => React.ReactNode
  /** Ruta del detalle en teléfono. */
  rutaDetalle: (id: string) => string
}

/** Bandeja de autorizaciones (láminas Autorizaciones y TabAutorizaciones; propuesta "Finanzas como venta", frames 16 a 18). */
export function BandejaAutorizaciones({ detalle, rutaDetalle }: Props) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const { isTabletLandscape } = useResponsive()
  const puede = useAuthStore((s) => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  // La web solo deja decidir con la capacidad Y modificar Ventas (VentaGestionDetail.tsx:146-149).
  const puedeDecidir = useAuthStore((s) => s.hasCapability('CAP_AUTORIZAR_VENTA') && s.canDo('MOD_VENTAS', 'update'))
  const q = usePendientesAutorizacion(puede)
  const [filtro, setFiltro] = useFiltroPersistente<ClaveMotivo | 'todas'>('autorizaciones.filtro', 'todas')
  const [elegida, setElegida] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<{ venta: VentaPendienteAutorizacion; decision: Decision } | null>(null)

  const [aviso, setAviso] = useState<string | null>(null)

  const lista = q.data ?? []
  const sinRed = q.isError && esFallaDeRed(q.error)
  const visibles = lista.filter((v) => tieneMotivo(v.motivoPendienteAutorizacion, filtro))
  const hero = heroDeBandeja(visibles)
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const abrir = (id: string) => {
    setAviso(null)
    if (isTabletLandscape) setElegida(id)
    else router.push(rutaDetalle(id) as never)
  }

  const encabezado = (
    <View style={{ gap: space[3], paddingBottom: space[3] }}>
      {hero ? (
        <HeroSaldo
          titulo="Por autorizar"
          saldo={0}
          cifra={hero.cifra}
          meta={hero.meta}
          vencido={null}
          tope={null}
          disponible={null}
          accessibilityLabel={`Por autorizar: ${hero.cifra}, ${hero.meta}`}
        />
      ) : null}
      {puedeDecidir ? null : (
        <MotivoDeshabilitado testID="motivo-sin-decidir">Para decidir necesitás el permiso de modificar ventas.</MotivoDeshabilitado>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Motivo" contentContainerStyle={{ gap: space[2] }}>
        {filtrosConConteo(lista).map((f) => (
          <FiltroChip
            key={f.clave}
            rol="radio"
            label={`${f.label} · ${f.cantidad}`}
            accessibilityLabel={`${f.label}: ${f.cantidad}`}
            activo={f.clave === filtro}
            onPress={() => setFiltro(f.clave)}
          />
        ))}
      </ScrollView>
      {aviso ? <Notice tone="peligro">{aviso}</Notice> : null}
      {sinRed && lista.length > 0 ? <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice> : null}
    </View>
  )

  const tarjeta = (v: VentaPendienteAutorizacion) => {
    const conRazon = pideRazon(v.motivoPendienteAutorizacion)
    const cliente = clienteDeBandeja(v)
    return (
      <View style={{ marginBottom: space[3], padding: space[4], gap: space[2], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver la venta de ${v.clienteDisplayName}`} onPress={() => abrir(v.id)} style={{ gap: space[1], minHeight: 44 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
            <Text numberOfLines={1} style={[secundario, { flexShrink: 1 }]}>{v.codigoPedido ? `${v.codigoPedido} · ${v.vendedorNombre}` : v.vendedorNombre}</Text>
            <Text style={secundario}>{formatRelativeTime(v.fechaPendiente)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
            <Text numberOfLines={2} style={[typeScale.cuerpoDestacado, { color: c.text, flex: 1 }]}>{cliente.titulo}</Text>
          </View>
          {cliente.nombre ? <Text numberOfLines={1} style={[typeScale.secundario, { color: c.text }]}>{cliente.nombre}</Text> : null}
          {/* Pastillas cortas con texto (la lámina); la frase de cada motivo está en el detalle. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {motivosDe(v.motivoPendienteAutorizacion).map((m) => <StatusChip key={m.clave} estado="porAutorizar" label={m.filtro} />)}
          </View>
          <TotalsRow label="Total" importe={v.totalAmount} />
        </Pressable>
        {puedeDecidir ? (
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1 }}><Button label="Rechazar" variant="secundario" accessibilityLabel={`Rechazar la venta de ${v.clienteDisplayName}`} onPress={() => { setAviso(null); setDecidiendo({ venta: v, decision: 'rechazar' }) }} /></View>
          <View style={{ flex: 1 }}>
            {conRazon
              ? <Button label="Revisar" accessibilityLabel={`Revisar la venta de ${v.clienteDisplayName}`} onPress={() => abrir(v.id)} />
              : <Button label="Autorizar" accessibilityLabel={`Autorizar la venta de ${v.clienteDisplayName}`} onPress={() => { setAviso(null); setDecidiendo({ venta: v, decision: 'autorizar' }) }} />}
          </View>
        </View>
        ) : null}
      </View>
    )
  }

  const cuerpo = !puede ? (
    <View style={{ padding: space[4] }}><Notice tone="info">Autorizar ventas necesita el permiso de autorizar ventas. Pedíselo a un administrador.</Notice></View>
  ) : (
    <FlatList
      data={visibles}
      keyExtractor={(v) => v.id}
      ListHeaderComponent={encabezado}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[12] + insetInferior }}
      renderItem={({ item }) => tarjeta(item)}
      refreshing={q.isRefetching}
      onRefresh={() => { setAviso(null); void q.refetch() }}
      ListEmptyComponent={
        q.isLoading ? <Esqueletos bloques={BANDEJA_CARGANDO} />
          : q.isError && sinRed && lista.length === 0 ? <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar las autorizaciones" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
          : q.isError && !sinRed ? <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudo cargar la bandeja. Deslizá hacia abajo para reintentar.')}</Notice>
          : <EstadoDePantalla tipo="vacio" titulo="No hay ventas por autorizar." />
      }
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Autorizaciones" subtitle="Más antiguas primero" leading={leading} />
      <TwoPane
        list={cuerpo}
        detail={isTabletLandscape && elegida ? detalle(elegida, () => setElegida(null)) : null}
        emptyDetail={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] }}><Text style={secundario}>Elegí una venta para decidir.</Text></View>}
      />
      <DecisionSheet
        decision={decidiendo?.decision ?? null}
        ventaId={decidiendo?.venta.id ?? ''}
        cliente={decidiendo?.venta.clienteDisplayName ?? ''}
        // La versión de la bandeja (#884) alcanza para decidir; sin ella, la hoja pide el detalle.
        version={decidiendo?.venta.version}
        fechaPendiente={decidiendo?.venta.fechaPendiente}
        onConflicto={setAviso}
        onClose={() => setDecidiendo(null)}
        onHecho={() => { if (decidiendo?.venta.id === elegida) setElegida(null) }}
      />
    </View>
  )
}

import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Notice, TopBar, TwoPane, formatImporte, useMenuLeading } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { usePendientesAutorizacion, type VentaPendienteAutorizacion } from '@/libs/api-client/ventas'
import { useAuthStore } from '@/libs/store/auth.store'
import { formatRelativeTime } from '@/src/utils/date'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { filtrosConConteo, motivosDe, pideRazon, tieneMotivo, type ClaveMotivo } from '../lib/motivos'
import { DecisionSheet, type Decision } from './DecisionSheet'

/** Total de la bandeja: solo si todas las ventas son de la misma moneda; si no, no hay una cifra honesta. */
export function totalDeBandeja(lista: VentaPendienteAutorizacion[]): number | null {
  if (lista.length === 0) return null
  const moneda = lista[0]!.totalCurrency
  if (lista.some((v) => v.totalCurrency !== moneda)) return null
  return lista.reduce((s, v) => s + v.totalAmount, 0)
}

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

/** Bandeja de autorizaciones (láminas Autorizaciones y TabAutorizaciones). */
export function BandejaAutorizaciones({ detalle, rutaDetalle }: Props) {
  const c = useColors()
  const router = useRouter()
  const leading = useMenuLeading()
  const { isTabletLandscape } = useResponsive()
  const puede = useAuthStore((s) => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  // La web solo deja decidir con la capacidad Y modificar Ventas (VentaGestionDetail.tsx:146-149).
  const puedeDecidir = useAuthStore((s) => s.hasCapability('CAP_AUTORIZAR_VENTA') && s.canDo('MOD_VENTAS', 'update'))
  const q = usePendientesAutorizacion(puede)
  const [filtro, setFiltro] = useState<ClaveMotivo | 'todas'>('todas')
  const [elegida, setElegida] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<{ venta: VentaPendienteAutorizacion; decision: Decision } | null>(null)

  const [aviso, setAviso] = useState<string | null>(null)

  const lista = q.data ?? []
  const visibles = lista.filter((v) => tieneMotivo(v.motivoPendienteAutorizacion, filtro))
  const total = totalDeBandeja(visibles)
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const abrir = (id: string) => {
    setAviso(null)
    if (isTabletLandscape) setElegida(id)
    else router.push(rutaDetalle(id) as never)
  }

  const encabezado = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Motivo" contentContainerStyle={{ gap: space[2] }}>
        {filtrosConConteo(lista).map((f) => {
          const sel = f.clave === filtro
          return (
            <Pressable
              key={f.clave}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${f.label}: ${f.cantidad}`}
              onPress={() => setFiltro(f.clave)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}
            >
              <Text style={[typeScale.secundario, { color: sel ? c.brandInk : c.text }]}>{`${f.label} ${f.cantidad}`}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {visibles.length > 0 ? (
        <Text accessibilityRole="summary" style={[typeScale.secundario, { color: c.text }]}>
          {`${visibles.length} POR AUTORIZAR${total !== null ? ` · ${formatImporte(total)}` : ''}`}
        </Text>
      ) : null}
      {aviso ? <Notice tone="peligro">{aviso}</Notice> : null}
      <Text style={secundario}>
        {puedeDecidir ? 'La que más espera, primero. «Autorizar» pide confirmación; «Rechazar» pide el motivo.' : 'La que más espera, primero. Para decidir necesitás el permiso de modificar ventas.'}
      </Text>
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
            <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatImporte(v.totalAmount)}</Text>
          </View>
          {cliente.nombre ? <Text numberOfLines={1} style={[typeScale.secundario, { color: c.text }]}>{cliente.nombre}</Text> : null}
          {motivosDe(v.motivoPendienteAutorizacion).map((m) => (
            <Text key={m.clave} style={[typeScale.secundario, { color: c.text }]}>{`• ${m.texto}`}</Text>
          ))}
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
      contentContainerStyle={{ padding: space[4], paddingBottom: space[12] }}
      renderItem={({ item }) => tarjeta(item)}
      refreshing={q.isRefetching}
      onRefresh={() => { setAviso(null); void q.refetch() }}
      ListEmptyComponent={
        q.isLoading ? <ActivityIndicator color={c.brand} />
          : q.isError ? <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudo cargar la bandeja. Deslizá hacia abajo para reintentar.')}</Notice>
          : <Text style={secundario}>No hay ventas por autorizar.</Text>
      }
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Autorizaciones" subtitle="Ventas que esperan tu decisión" leading={leading} />
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

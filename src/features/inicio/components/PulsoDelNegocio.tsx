import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { FilaDeInicio, HeroDeInicio, ImporteDeFila, ListaEnTarjeta } from './PiezasDeInicio'

interface PulsoProps {
  /** `null` en todos: el servidor todavía no lo da y se muestra "—", nunca 0. */
  ventasDelDia: number | null
  cantidadVentas: number | null
  pedidosPendientes: number | null
  rutasActivas: number | null
  meDeben: number | null
  debo: number | null
  /** Deuda vencida de clientes (> 30 días). Sin dato (`null`/ausente) la fila no se muestra. */
  deudaVencida?: number | null
  /** Con destino, Rutas activas abre la lista de hojas de ruta; sin él (sin permiso de Viajes) es solo la cifra. */
  onRutas?: () => void
  /** Lo que va entre el hero y los mosaicos: los atajos (frame 6). */
  children?: React.ReactNode
}

const cantidad = (n: number | null) => (n == null ? '—' : String(n))

/**
 * El pulso del negocio (propuesta de Inicio, frame 6; hero de la galería v2, inicio): "Ventas del día"
 * en el hero oscuro con la cifra grande y "N ventas", los atajos, Pedidos pendientes y Rutas activas
 * como mosaicos, y las cuentas en una lista con el monto a la derecha.
 */
export function PulsoDelNegocio({ ventasDelDia, cantidadVentas, pedidosPendientes, rutasActivas, meDeben, debo, deudaVencida = null, onRutas, children }: PulsoProps) {
  const ventas = cantidadVentas == null ? null : `${cantidadVentas} ${cantidadVentas === 1 ? 'venta' : 'ventas'}`
  return (
    <View style={{ gap: space[4], paddingHorizontal: space[4] }}>
      <HeroDeInicio testID="pulso-hero" etiqueta="Ventas del día" cifra={formatImporte(ventasDelDia)} meta={ventas} />
      {children}
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Mosaico etiqueta="Pedidos pendientes" valor={cantidad(pedidosPendientes)} />
        <Mosaico etiqueta="Rutas activas" valor={cantidad(rutasActivas)} onPress={onRutas} />
      </View>
      <ListaEnTarjeta>
        <Cuenta etiqueta="Me deben los clientes" valor={formatImporte(meDeben)} />
        <Cuenta etiqueta="Debo a proveedores" valor={formatImporte(debo)} />
        {deudaVencida != null ? <Cuenta etiqueta="Vencido (más de 30 días)" valor={formatImporte(deudaVencida)} vencido /> : null}
      </ListaEnTarjeta>
    </View>
  )
}

function Cuenta({ etiqueta, valor, vencido = false }: { etiqueta: string; valor: string; vencido?: boolean }) {
  return (
    <FilaDeInicio
      testID={vencido ? 'vencido' : undefined}
      titulo={etiqueta}
      punto={vencido ? 'peligro' : undefined}
      accessibilityLabel={`${etiqueta}: ${valor}`}
      derecha={<ImporteDeFila texto={valor} />}
    />
  )
}

/** Mosaico sin borde (galería v2): etiqueta arriba y la cifra; con destino, una flecha. */
function Mosaico({ etiqueta, valor, onPress }: { etiqueta: string; valor: string; onPress?: () => void }) {
  const c = useColors()
  const estilo = { flex: 1, minWidth: 0, paddingVertical: space[3], paddingHorizontal: space[4], gap: 2, borderRadius: radii.tarjeta, backgroundColor: c.surface }
  const contenido = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[1] }}>
        <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]} numberOfLines={1}>{etiqueta}</Text>
        {onPress ? <ChevronRight size={18} color={c.textSecondary} strokeWidth={2} /> : null}
      </View>
      <Text style={[typeScale.titulo, cifras, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
    </>
  )
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor}`} onPress={onPress} android_ripple={{ color: c.surface2 }} style={estilo}>
        {contenido}
      </Pressable>
    )
  }
  return (
    <View accessible accessibilityLabel={`${etiqueta}: ${valor}`} style={estilo}>
      {contenido}
    </View>
  )
}

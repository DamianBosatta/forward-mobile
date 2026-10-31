import React from 'react'
import { Text, View } from 'react-native'
import { importe as cifras, radii, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'

interface PulsoProps {
  /** `null` en todos: el servidor todavía no lo da y se muestra "—", nunca 0. */
  ventasDelDia: number | null
  cantidadVentas: number | null
  pedidosPendientes: number | null
  rutasActivas: number | null
  meDeben: number | null
  debo: number | null
  /** Deuda vencida de clientes (> 30 días). Sin dato (`null`/ausente) la cifra no se muestra. */
  deudaVencida?: number | null
}

const cantidad = (n: number | null) => (n == null ? '—' : String(n))

/** El pulso del negocio en 5 segundos (lámina inicio-general): ventas del día en grande y cuatro cifras de apoyo. */
export function PulsoDelNegocio({ ventasDelDia, cantidadVentas, pedidosPendientes, rutasActivas, meDeben, debo, deudaVencida = null }: PulsoProps) {
  const c = useColors()
  // Claro: tarjeta oscura (barra). Oscuro: la barra es del color del fondo y la tarjeta se perdía; usa la superficie con borde de la lámina.
  const oscuro = useIsDark()
  const hero = oscuro
    ? { fondo: c.surface, borde: c.border, etiqueta: c.textSecondary, cifra: c.text }
    : { fondo: c.topBar, borde: c.topBar, etiqueta: c.onTopBar, cifra: c.onTopBarStrong }
  const tarjeta = { padding: space[4], gap: space[1], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }
  const ventas = cantidadVentas == null ? null : `${cantidadVentas} ${cantidadVentas === 1 ? 'venta' : 'ventas'}`
  return (
    <View style={{ gap: space[3], paddingHorizontal: space[4] }}>
      <View
        accessible
        accessibilityLabel={`Ventas del día: ${formatImporte(ventasDelDia)}${ventas ? `, ${ventas}` : ''}`}
        testID="pulso-hero"
        style={[tarjeta, { backgroundColor: hero.fondo, borderColor: hero.borde }]}
      >
        <Text style={[typeScale.secundario, { color: hero.etiqueta }]}>Ventas del día</Text>
        <Text style={[typeScale.titulo, cifras, { color: hero.cifra }]} adjustsFontSizeToFit numberOfLines={1}>{formatImporte(ventasDelDia)}</Text>
        {ventas ? <Text style={[typeScale.secundario, { color: hero.etiqueta }]}>{ventas}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Cifra etiqueta="Pedidos pendientes" valor={cantidad(pedidosPendientes)} />
        <Cifra etiqueta="Rutas activas" valor={cantidad(rutasActivas)} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Cifra etiqueta="Me deben los clientes" valor={formatImporte(meDeben)} />
        <Cifra etiqueta="Debo a proveedores" valor={formatImporte(debo)} />
      </View>
      {deudaVencida != null ? (
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Cifra etiqueta="Vencido (más de 30 días)" valor={formatImporte(deudaVencida)} />
        </View>
      ) : null}
    </View>
  )
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const c = useColors()
  return (
    <View
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
      style={{ flex: 1, minWidth: 0, padding: space[3], gap: space[1], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
    >
      <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={1}>{etiqueta}</Text>
      <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
    </View>
  )
}

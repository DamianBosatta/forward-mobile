import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'
import { Button, Field, FormContainer, Notice, PasosNumerados, formatImporte } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useSocio, useSocios } from '@/libs/api-client/socios'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useComprasDelProveedor } from '@/features/proveedores/hooks/useProveedores'
import { formatToLocalDate } from '@/src/utils/date'
import { franjaTexto } from '../lib/fecha'

export const PASOS_COMPRA = ['Proveedor', 'Productos', 'Confirmar'] as const

interface Props {
  onElegir: (id: string) => void
  /** Proveedor elegido al que le faltan datos de compra: no se le puede comprar todavía. */
  faltantes: { nombre: string; lista: string[] } | null
  error: string | null
}

/**
 * Paso 1 de la compra nueva (lámina compras-nueva-1-proveedor): el proveedor se elige de la lista (no se dan de
 * alta en mobile), se ven sus condiciones y recién con "Continuar a productos" se crea el borrador.
 */
export function ElegirProveedor({ onElegir, faltantes, error }: Props) {
  const c = useColors()
  const [busqueda, setBusqueda] = useState('')
  const [enviada, setEnviada] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const ficha = useSocio(elegido ?? '')
  // "Última compra": la compra más reciente del proveedor (GET /Compras?proveedorId=, MOD_COMPRAS:Read).
  const puedeVerCompras = usePermissions().canDo('MOD_COMPRAS', 'read')
  const ultimas = useComprasDelProveedor(elegido ?? '', puedeVerCompras, 1)
  const ultima = ultimas.data?.items?.[0]
  useEffect(() => {
    const t = setTimeout(() => setEnviada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])
  const q = useSocios({ tipo: 2, activo: true, pageSize: 50, search: enviada.length >= 2 ? enviada : undefined })
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const condicion = ficha.data?.condicionPago?.descripcion ?? null
  const franja = franjaTexto(ficha.data?.franjaEntrega)
  const fila = (k: string, v: string | null) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3], paddingVertical: space[1] }}>
      <Text style={secundario}>{k}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], flexShrink: 1 }}>
        <Text style={[typeScale.secundario, { color: c.text, flexShrink: 1, textAlign: 'right' }]}>{v ?? '—'}</Text>
        <Lock size={14} color={c.textSecondary} />
      </View>
    </View>
  )

  const textoUltima = ultimas.isLoading ? 'Cargando…'
    : ultimas.isError ? 'No se pudo cargar'
    : ultima ? `${formatToLocalDate(ultima.fecha)} · ${formatImporte(ultima.totalAmount, { moneda: ultima.totalCurrency })}`
    : 'Sin compras'

  return (
    <View style={{ flex: 1 }}>
      <PasosNumerados nombres={PASOS_COMPRA} paso={1} />
      <FlatList
        style={{ flex: 1 }}
        data={q.data?.items ?? []}
        keyExtractor={(p) => p.id}
        extraData={[elegido, condicion, franja]}
        contentContainerStyle={{ padding: space[4], gap: space[2] }}
        ListHeaderComponent={
          <FormContainer style={{ gap: space[3], paddingBottom: space[2] }}>
            <Field label="Proveedor" placeholder="Nombre, CUIT o código" value={busqueda} onChangeText={setBusqueda} autoCorrect={false} />
            {faltantes ? (
              <Notice tone="advertencia" title={`A ${faltantes.nombre} le falta ${faltantes.lista.join(' y ')}.`}>
                Completalo en la web para poder comprarle.
              </Notice>
            ) : null}
            {error ? <Notice tone="peligro">{error}</Notice> : null}
            <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>{enviada.length >= 2 ? 'Resultados' : 'Proveedores'}</Text>
          </FormContainer>
        }
        renderItem={({ item: p }) => {
          const sel = p.id === elegido
          return (
            <FormContainer>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={p.requiereCompletar ? `${p.razonSocial}, faltan datos de compra` : p.razonSocial}
                accessibilityState={{ selected: sel }}
                onPress={() => setElegido(p.id)}
                android_ripple={{ color: c.surface2 }}
                style={{ minHeight: 56, justifyContent: 'center', padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: sel ? c.brand : 'transparent', backgroundColor: sel ? c.brandSoft : c.surface, gap: space[1], overflow: 'hidden' }}
              >
                <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{p.razonSocial}</Text>
                {p.cuit ? <Text style={secundario}>{`CUIT ${p.cuit}`}</Text> : null}
                {p.requiereCompletar ? <Text style={secundario}>Faltan datos de compra: se completan en la web</Text> : null}
              </Pressable>
            </FormContainer>
          )
        }}
        ListEmptyComponent={
          q.isLoading ? <ActivityIndicator color={c.brand} />
            : q.isError ? <Notice tone="peligro">No se pudieron cargar los proveedores.</Notice>
            : <View><Text style={secundario}>No hay proveedores con esa búsqueda.</Text></View>
        }
        // TODO API: las condiciones editables no existen en el servidor; las condiciones van de solo lectura.
        ListFooterComponent={elegido ? (
          <FormContainer style={{ marginTop: space[3], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
            <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>Condiciones del proveedor</Text>
            {fila('Plazo de pago', condicion)}
            {fila('Franja horaria', franja)}
            {puedeVerCompras ? (
              <View accessible accessibilityLabel={`Última compra: ${textoUltima}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3], paddingVertical: space[1] }}>
                <Text style={secundario}>Última compra</Text>
                <Text style={[typeScale.secundario, { color: c.text, flexShrink: 1, textAlign: 'right' }]}>{textoUltima}</Text>
              </View>
            ) : null}
            <Text style={secundario}>Se cambian en la ficha del proveedor, en la web.</Text>
          </FormContainer>
        ) : null}
      />
      <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
        <Button label="Continuar a productos" disabled={!elegido} onPress={() => { if (elegido) onElegir(elegido) }} />
      </View>
    </View>
  )
}

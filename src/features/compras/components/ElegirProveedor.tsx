import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { Pressable } from '@/core/ui/fw/Pressable'
import { Field, FormContainer, Notice } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useSocios } from '@/libs/api-client/socios'

interface Props {
  onElegir: (id: string) => void
  /** Proveedor elegido al que le faltan datos de compra: no se le puede comprar todavía. */
  faltantes: { nombre: string; lista: string[] } | null
  error: string | null
}

/** Paso 1 de la compra nueva: el proveedor se elige de la lista (proveedores no se dan de alta en mobile). */
export function ElegirProveedor({ onElegir, faltantes, error }: Props) {
  const c = useColors()
  const [busqueda, setBusqueda] = useState('')
  const [enviada, setEnviada] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setEnviada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])
  const q = useSocios({ tipo: 2, activo: true, pageSize: 50, search: enviada.length >= 2 ? enviada : undefined })
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  return (
    <FlatList
      data={q.data?.items ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: space[4], gap: space[2] }}
      ListHeaderComponent={
        <FormContainer style={{ gap: space[3], paddingBottom: space[2] }}>
          <Field label="Proveedor" placeholder="Buscar por razón social" value={busqueda} onChangeText={setBusqueda} autoCorrect={false} />
          {faltantes ? (
            <Notice tone="advertencia" title={`A ${faltantes.nombre} le falta ${faltantes.lista.join(' y ')}.`}>
              Completalo en la web para poder comprarle.
            </Notice>
          ) : null}
          {error ? <Notice tone="peligro">{error}</Notice> : null}
        </FormContainer>
      }
      renderItem={({ item: p }) => (
        <FormContainer>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.requiereCompletar ? `${p.razonSocial}, faltan datos de compra` : p.razonSocial}
            onPress={() => onElegir(p.id)}
            style={({ pressed }) => ({ minHeight: 56, justifyContent: 'center', padding: space[4], borderRadius: radii.tarjeta, backgroundColor: pressed ? c.surface2 : c.surface, gap: space[1] })}
          >
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{p.razonSocial}</Text>
            {p.requiereCompletar ? <Text style={secundario}>Faltan datos de compra: se completan en la web</Text> : null}
          </Pressable>
        </FormContainer>
      )}
      ListEmptyComponent={
        q.isLoading ? <ActivityIndicator color={c.brand} />
          : q.isError ? <Notice tone="peligro">No se pudieron cargar los proveedores.</Notice>
          : <View><Text style={secundario}>No hay proveedores con esa búsqueda.</Text></View>
      }
    />
  )
}

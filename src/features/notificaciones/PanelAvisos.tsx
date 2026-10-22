import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'
import { useBandejaAvisos } from '@/libs/api-client/notificaciones'
import { AvisoFila } from './AvisoFila'
import { cuandoFue, destinoDelAviso } from './bandeja'
import { useAbrirAviso } from './useAbrirAviso'

/** Los avisos junto al calendario en tablet (lámina TM10): los últimos, con "Marcar leídos". */
export function PanelAvisos() {
  const c = useColors()
  const q = useBandejaAvisos(false)
  const { abrir, marcar } = useAbrirAviso()
  const avisos = q.data?.pages[0]?.items ?? []
  const noLeidas = q.data?.pages[0]?.noLeidas ?? 0
  const ahora = Date.now()
  return (
    <View testID="panel-avisos" style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[4], minHeight: 56 }}>
        <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{noLeidas > 0 ? `Avisos · ${noLeidas}` : 'Avisos'}</Text>
        <Pressable
          onPress={() => marcar.mutate(undefined)}
          disabled={noLeidas === 0 || marcar.isPending}
          accessibilityRole="button"
          accessibilityLabel="Marcar leídos"
          accessibilityState={{ disabled: noLeidas === 0 || marcar.isPending }}
          style={{ minHeight: 44, justifyContent: 'center', opacity: noLeidas === 0 ? 0.4 : 1 }}
        >
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Marcar leídos</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[12], gap: space[3] }}>
        {q.isLoading ? (
          <ActivityIndicator color={c.brand} accessibilityLabel="Cargando los avisos" />
        ) : q.isError ? (
          <Notice tone="peligro">No se pudieron cargar los avisos.</Notice>
        ) : avisos.length === 0 ? (
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No tenés avisos.</Text>
        ) : (
          avisos.map((a) => (
            <AvisoFila key={a.id} aviso={a} destino={destinoDelAviso(a.accion)} cuando={cuandoFue(a.fechaCreacion, ahora)} onPress={() => abrir(a)} />
          ))
        )}
      </ScrollView>
    </View>
  )
}

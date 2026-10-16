import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { FormContainer, Notice, TopBar } from '@/core/ui/fw'
import { useActualizarPreferenciasAvisos, usePreferenciasAvisos, type PreferenciaAviso } from '@/libs/api-client/notificaciones'
import { avisoDeTipo } from './avisos'

const mensajeDe = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)

/**
 * Qué avisos saltan al llegar (toast de la web). Se guarda en el servidor por usuario; mobile no
 * tiene push todavía (BACKLOG-9B), así que acá solo se edita.
 */
export function PreferenciasAvisos() {
  const c = useColors()
  const router = useRouter()
  const q = usePreferenciasAvisos()
  const guardar = useActualizarPreferenciasAvisos()

  // Mientras se guarda, el interruptor ya muestra lo elegido; si el servidor lo rechaza vuelve solo.
  const prendido = (p: PreferenciaAviso) => {
    const pendiente = guardar.isPending ? guardar.variables?.find((v) => v.tipo === p.tipo) : undefined
    return pendiente?.toast ?? p.toast
  }

  const fila = (p: PreferenciaAviso) => {
    const etiqueta = avisoDeTipo(p.tipo)?.etiqueta ?? p.tipo
    const valor = !p.silenciable || prendido(p)
    return (
      <Pressable
        key={p.tipo}
        accessibilityRole="switch"
        accessibilityLabel={etiqueta}
        accessibilityState={{ checked: valor, disabled: !p.silenciable }}
        disabled={!p.silenciable}
        onPress={() => guardar.mutate([{ tipo: p.tipo, toast: !valor }])}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...typeScale.cuerpo, color: c.text }}>{etiqueta}</Text>
          {p.silenciable ? null : <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Crítico: no se puede silenciar</Text>}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
          <Switch value={valor} disabled={!p.silenciable} trackColor={{ false: c.border, true: c.action }} />
        </View>
      </Pressable>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Preferencias de avisos" leading={{ kind: 'atras', onPress: () => router.back() }} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] }}>
        <FormContainer style={{ gap: space[3] }}>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            Todos los avisos quedan en la bandeja. Elegí cuáles saltan apenas llegan en la web; en el teléfono se ven en la bandeja y en el número del menú.
          </Text>
          {guardar.isError ? <Notice tone="peligro">{mensajeDe(guardar.error, 'No se pudo guardar la preferencia.')}</Notice> : null}
          {q.isLoading ? (
            <ActivityIndicator color={c.brand} accessibilityLabel="Cargando las preferencias" />
          ) : q.isError ? (
            <Notice tone="peligro">{mensajeDe(q.error, 'No se pudieron cargar las preferencias.')}</Notice>
          ) : (
            <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, paddingHorizontal: space[4], paddingVertical: space[2] }}>
              {(q.data ?? []).map(fila)}
            </View>
          )}
        </FormContainer>
      </ScrollView>
    </View>
  )
}

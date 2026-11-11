import React from 'react'
import { ScrollView, Switch, Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { FilaInterruptor, FormContainer, Notice, TopBar } from '@/core/ui/fw'
import { useActualizarPreferenciasAvisos, usePreferenciasAvisos, type PreferenciaAviso } from '@/libs/api-client/notificaciones'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'
import { GRUPOS_DE_AVISOS, avisoDeTipo, grupoDeTipo } from './avisos'

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

  const fila = (p: PreferenciaAviso, ultima: boolean) => {
    const etiqueta = avisoDeTipo(p.tipo)?.etiqueta ?? p.tipo
    const valor = !p.silenciable || prendido(p)
    // Crítico (lo marca el servidor): candado, su texto y el interruptor atenuado (propuesta Cuenta, frame 12).
    if (!p.silenciable) return <FilaCritica key={p.tipo} titulo={etiqueta} conDivisor={!ultima} />
    return (
      <FilaInterruptor
        key={p.tipo}
        titulo={etiqueta}
        apoyo={valor ? 'Salta apenas llega' : 'Solo en la bandeja'}
        prendido={valor}
        onChange={() => guardar.mutate([{ tipo: p.tipo, toast: !valor }])}
        conDivisor={!ultima}
      />
    )
  }

  // Los temas salen de una tabla del cliente; dentro de cada uno queda el orden del servidor.
  const temas = [...GRUPOS_DE_AVISOS, 'Otros' as const]
    .map((tema) => ({ tema, filas: (q.data ?? []).filter((p) => grupoDeTipo(p.tipo) === tema) }))
    .filter((g) => g.filas.length > 0)

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
            <Esqueletos bloques={[{ alto: 150, testID: 'esqueleto-grupo' }]} />
          ) : q.isError ? (
            <Notice tone="peligro">{mensajeDe(q.error, 'No se pudieron cargar las preferencias.')}</Notice>
          ) : (
            temas.map(({ tema, filas }) => (
              <View key={tema} style={{ gap: space[2] }}>
                <Text accessibilityRole="header" style={{ ...typeScale.etiqueta, color: c.textSecondary, paddingHorizontal: space[2], textTransform: 'uppercase' }}>{tema}</Text>
                <View testID={`grupo-${tema}`} style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, overflow: 'hidden' }}>
                  {filas.map((p, i) => fila(p, i === filas.length - 1))}
                </View>
              </View>
            ))
          )}
        </FormContainer>
      </ScrollView>
    </View>
  )
}

/**
 * Fila de un aviso crítico: siempre prendido y no se puede tocar. Mismo rótulo y estado accesible que la fila de
 * interruptor deshabilitada; suma el candado junto al texto y atenúa el interruptor para explicar por qué no se mueve.
 */
function FilaCritica({ titulo, conDivisor }: { titulo: string; conDivisor: boolean }) {
  const c = useColors()
  return (
    <View
      accessible
      accessibilityRole="switch"
      accessibilityLabel={titulo}
      accessibilityState={{ checked: true, disabled: true }}
      style={[
        { minHeight: 64, paddingHorizontal: space[4], paddingVertical: space[2], flexDirection: 'row', alignItems: 'center', gap: space[3] },
        conDivisor ? { borderBottomWidth: 1, borderBottomColor: c.border } : null,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{titulo}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <View testID="candado-critico"><Lock size={14} color={c.textSecondary} /></View>
          <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>Crítico: no se puede silenciar</Text>
        </View>
      </View>
      <View testID="interruptor-atenuado" pointerEvents="none" style={{ opacity: 0.5 }}>
        <Switch value disabled trackColor={{ false: c.border, true: c.action }} thumbColor={c.onAction} />
      </View>
    </View>
  )
}

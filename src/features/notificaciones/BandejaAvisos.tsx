import React, { useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCheck, Settings } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TopBar, useMenuLeading } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { CalendarioAvisosTabs } from '@/core/ui/fw/CalendarioAvisosTabs'
import { useBandejaAvisos } from '@/libs/api-client/notificaciones'
import { AvisoFila } from './AvisoFila'
import { cuandoFue, destinoDelAviso } from './bandeja'
import { useAbrirAviso } from './useAbrirAviso'

const mensajeDe = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)

/** Bandeja de avisos: lo que el servidor manda al usuario, más nuevo primero, de a páginas. */
export function BandejaAvisos() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const [soloNoLeidas, setSoloNoLeidas] = useState(false)
  const q = useBandejaAvisos(soloNoLeidas)
  const { abrir, marcar } = useAbrirAviso()
  const avisos = q.data?.pages.flatMap((p) => p.items) ?? []
  const noLeidas = q.data?.pages[0]?.noLeidas ?? 0
  const ahora = Date.now()
  const sinRed = q.isError && esFallaDeRed(q.error)
  // Sin conexión con avisos ya guardados: se siguen viendo, con un aviso; cualquier otro error los oculta como siempre.
  const verAvisos = !q.isError || (sinRed && avisos.length > 0)

  const vacio = q.isLoading ? (
    <ActivityIndicator color={c.brand} accessibilityLabel="Cargando los avisos" />
  ) : q.isError && sinRed ? (
    <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los avisos" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
  ) : q.isError ? (
    <View style={{ gap: space[3] }}>
      <Notice tone="peligro">{mensajeDe(q.error, 'No se pudieron cargar los avisos.')}</Notice>
      <Button label="Reintentar" variant="secundario" onPress={() => void q.refetch()} />
    </View>
  ) : (
    <EstadoDePantalla tipo="vacio" titulo={soloNoLeidas ? 'No tenés avisos sin leer.' : 'No tenés avisos.'} />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Avisos"
        subtitle={q.data ? (noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo leído') : undefined}
        leading={menu}
        actions={[
          { icon: CheckCheck, accessibilityLabel: 'Marcar todas como leídas', onPress: () => marcar.mutate(undefined), disabled: noLeidas === 0 || marcar.isPending },
          { icon: Settings, accessibilityLabel: 'Preferencias de avisos', onPress: () => router.push('/avisos/preferencias' as never) },
        ]}
        tabs={[
          { label: 'Todos', selected: !soloNoLeidas, onPress: () => setSoloNoLeidas(false) },
          { label: 'Sin leer', selected: soloNoLeidas, onPress: () => setSoloNoLeidas(true) },
        ]}
      />
      <CalendarioAvisosTabs actual="avisos" sinLeer={noLeidas} onElegir={() => router.push('/calendario' as never)} />
      <FlatList
        data={verAvisos ? avisos : []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} />}
        ListHeaderComponent={
          <>
            {sinRed && verAvisos ? <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice> : null}
            {marcar.isError ? <Notice tone="peligro">{mensajeDe(marcar.error, 'No se pudo marcar como leído.')}</Notice> : null}
          </>
        }
        ListEmptyComponent={<FormContainer>{vacio}</FormContainer>}
        renderItem={({ item }) => (
          <FormContainer>
            <AvisoFila aviso={item} destino={destinoDelAviso(item.accion)} cuando={cuandoFue(item.fechaCreacion, ahora)} onPress={() => abrir(item)} />
          </FormContainer>
        )}
        ListFooterComponent={
          <>
            {q.hasNextPage ? (
              <FormContainer>
                <Button label="Ver avisos anteriores" variant="secundario" loading={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} />
              </FormContainer>
            ) : null}
            {/* Los avisos salen de los eventos del calendario: no hay "crear aviso". */}
            <FormContainer style={{ marginTop: space[4] }}>
              <Button label="Nuevo evento" variant="secundario" onPress={() => router.push('/calendario?nuevo=1' as never)} />
            </FormContainer>
          </>
        }
      />
    </View>
  )
}

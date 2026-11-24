import React, { memo, useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCheck, Settings } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, Segmented, TopBar, useMenuLeading, useInsetInferior } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'
import { useBandejaAvisos } from '@/libs/api-client/notificaciones'
import { AvisoFila } from './AvisoFila'
import { CalendarioAvisosTabs } from '@/core/ui/fw/CalendarioAvisosTabs'
import { conEncabezadosDeDia, destinoDelAviso, horaDelAviso, type FilaDeBandeja } from './bandeja'
import type { Aviso } from '@/libs/api-client/notificaciones'
import { LISTA_LARGA_PROPS } from '@/core/ui/listaLargaProps'
import { useAbrirAviso } from './useAbrirAviso'

type Filtro = 'todos' | 'sinLeer'
/** Dos tarjetas de aviso mientras carga (propuesta Cuenta, frame 10). */
const AVISOS_CARGANDO = [{ alto: 110 }, { alto: 110 }]
const mensajeDe = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)

type FilaBandeja = FilaDeBandeja<Aviso>

/** Fila memoizada: encabezado de día o tarjeta de aviso; no se repinta si el aviso no cambió. */
const FilaDeBandeja = memo(function FilaDeBandeja({ item, onAbrir }: { item: FilaBandeja; onAbrir: ReturnType<typeof useAbrirAviso>['abrir'] }) {
  const c = useColors()
  return (
    <FormContainer>
      {item.tipo === 'dia' ? (
        <Text accessibilityRole="header" style={{ ...typeScale.etiqueta, color: c.textSecondary, marginTop: space[2] }}>{item.titulo}</Text>
      ) : (
        <AvisoFila variante="tarjeta" aviso={item.aviso} destino={destinoDelAviso(item.aviso.accion)} cuando={horaDelAviso(item.aviso.fechaCreacion)} onPress={() => onAbrir(item.aviso)} />
      )}
    </FormContainer>
  )
})

/** Bandeja de avisos: lo que el servidor manda al usuario, más nuevo primero, de a páginas. */
export function BandejaAvisos() {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const [soloNoLeidas, setSoloNoLeidas] = useState(false)
  const q = useBandejaAvisos(soloNoLeidas)
  const { abrir, marcar } = useAbrirAviso()
  const avisos = q.data?.pages.flatMap((p) => p.items) ?? []
  const noLeidas = q.data?.pages[0]?.noLeidas ?? 0
  const ahora = Date.now()
  const filas = conEncabezadosDeDia(avisos, ahora)
  const sinRed = q.isError && esFallaDeRed(q.error)
  // Sin conexión con avisos ya guardados: se siguen viendo, con un aviso; cualquier otro error los oculta como siempre.
  const verAvisos = !q.isError || (sinRed && avisos.length > 0)

  const renderFila = useCallback(({ item }: { item: FilaBandeja }) => <FilaDeBandeja item={item} onAbrir={abrir} />, [abrir])

  const vacio = q.isLoading ? (
    <Esqueletos bloques={AVISOS_CARGANDO} />
  ) : q.isError && sinRed ? (
    <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los avisos" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
  ) : q.isError ? (
    <View style={{ gap: space[3] }}>
      <Notice tone="peligro">{mensajeDe(q.error, 'No se pudieron cargar los avisos.')}</Notice>
      <Button label="Reintentar" variant="secundario" onPress={() => void q.refetch()} />
    </View>
  ) : (
    <EstadoDePantalla
      tipo="vacio"
      titulo={soloNoLeidas ? 'No tenés avisos sin leer.' : 'No tenés avisos.'}
      texto="Acá te avisamos de tus ventas, cobros y pagos, vencimientos del calendario, facturación y stock."
      accion={soloNoLeidas ? undefined : { label: 'Crear evento en el calendario', onPress: () => router.push('/calendario?nuevo=1' as never) }}
    />
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
      />
      <FlatList {...LISTA_LARGA_PROPS}
        data={verAvisos ? filas : []}
        keyExtractor={(f) => f.clave}
        contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] + insetInferior }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} />}
        ListHeaderComponent={
          <View style={{ gap: space[3] }}>
            <FormContainer style={{ gap: space[3] }}>
              {/* Propuesta Cuenta, frame 8: "Calendario | Avisos N" baja al cuerpo, arriba del filtro. */}
              <CalendarioAvisosTabs actual="avisos" sinLeer={noLeidas} onElegir={() => router.push('/calendario' as never)} />
              <Segmented<Filtro>
                accessibilityLabel="Filtrar avisos"
                value={soloNoLeidas ? 'sinLeer' : 'todos'}
                onChange={(v) => setSoloNoLeidas(v === 'sinLeer')}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'sinLeer', label: noLeidas > 0 ? `Sin leer · ${noLeidas}` : 'Sin leer' },
                ]}
              />
            </FormContainer>
            {sinRed && verAvisos ? <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice> : null}
            {marcar.isError ? <Notice tone="peligro">{mensajeDe(marcar.error, 'No se pudo marcar como leído.')}</Notice> : null}
          </View>
        }
        ListEmptyComponent={<FormContainer>{vacio}</FormContainer>}
        renderItem={renderFila}
        ListFooterComponent={
          <>
            {q.hasNextPage ? (
              <FormContainer>
                <Button label="Ver avisos anteriores" variant="secundario" size="lg" loading={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} />
              </FormContainer>
            ) : null}
            {/* Los avisos salen de los eventos del calendario: no hay "crear aviso". */}
            {avisos.length > 0 ? (
            <FormContainer style={{ marginTop: space[2] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nuevo evento"
                onPress={() => router.push('/calendario?nuevo=1' as never)}
                android_ripple={{ color: c.surface2 }}
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk, textAlign: 'center' }}>Nuevo evento</Text>
              </Pressable>
            </FormContainer>
            ) : null}
          </>
        }
      />
    </View>
  )
}

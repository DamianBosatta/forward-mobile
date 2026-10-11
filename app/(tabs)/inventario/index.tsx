import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Text, TextInput, View } from 'react-native'
import { useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { useMutation } from '@tanstack/react-query'
import { LayoutGrid, List, ScanBarcode, Search } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Notice, TopBar } from '@/core/ui/fw'
import { RequirePermission } from '@/core/ui'
import { ApiError } from '@/core/api/client'
import { buscarPorCodigoBarra } from '@/libs/api-client/productos'
import { useCatalogoConsulta } from '@/features/catalogo/hooks/useCatalogoConsulta'
import { ProductoCard } from '@/features/catalogo/components/ProductoCard'
import { FichaProducto } from '@/features/catalogo/components/FichaProducto'
import { EscanerCodigo } from '@/features/catalogo/components/EscanerCodigo'

/** Ancho desde el que la grilla y la ficha van lado a lado (plan §8, lámina TabCatalogoConsulta). */
const ANCHO_DOS_PANELES = 900

/** El aviso de un escaneo que falló: sin red (no llegó respuesta), código rechazado (400) u otro error. */
function falloDelEscaneo(error: Error, codigo?: string): string {
  if (!(error instanceof ApiError)) return `Sin conexión: no se pudo buscar el código ${codigo}. Volvé a escanear cuando haya señal.`
  return error.status === 400 ? `El código ${codigo} no es válido.` : `No se pudo buscar el código ${codigo}. Volvé a intentar.`
}

/** Catálogo y stock, solo consulta (láminas CatalogoConsulta, FichaProducto y TabCatalogoConsulta). */
export default function CatalogoConsultaScreen() {
  const navigation = useNavigation()
  const c = useColors()
  const { width } = useResponsive()
  const dosPaneles = width >= ANCHO_DOS_PANELES
  const [grillaElegida, setGrilla] = useState(false)
  const grilla = dosPaneles || grillaElegida
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const cat = useCatalogoConsulta()
  const columnas = grilla ? 2 : 1
  const [escaneando, setEscaneando] = useState(false)
  // Código leído: el producto con ese código exacto; una fragancia abre la ficha de su línea. Sin red
  // falla enseguida (`always`): no queda en pausa para abrir una ficha cuando vuelva la señal.
  // Otro escaneo, tocar una tarjeta, tipear o salir dejan sin efecto el escaneo en curso.
  const corte = useRef<AbortController | null>(null)
  const escaneo = useMutation({
    mutationFn: (codigo: string) => {
      corte.current?.abort()
      corte.current = new AbortController()
      return buscarPorCodigoBarra(codigo, corte.current.signal)
    },
    networkMode: 'always',
  })
  const cancelarEscaneo = () => { corte.current?.abort(); escaneo.reset() }
  useEffect(() => () => corte.current?.abort(), [])
  const codigo = escaneo.variables
  const avisoEscaneo = escaneo.isPending ? { tone: 'info' as const, texto: `Buscando el código ${codigo}…` }
    : escaneo.error ? { tone: 'peligro' as const, texto: falloDelEscaneo(escaneo.error, codigo) }
    : escaneo.isSuccess && !escaneo.data ? { tone: 'advertencia' as const, texto: `No hay ningún producto con el código ${codigo}.` } : null

  const lista = (
    <View style={{ flex: 1 }}>
      <View
        style={{
          minHeight: 52,
          justifyContent: 'center',
          paddingHorizontal: space[4],
          backgroundColor: c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <Text style={[typeScale.secundario, { color: c.text, fontFamily: FONT.semibold, fontWeight: '600' }]}>
          {cat.totalCount != null ? `MOSTRANDO ${cat.productos.length} DE ${cat.totalCount}` : ' '}
        </Text>
      </View>
      {cat.isLoading ? (
        <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
      ) : cat.isError ? (
        <View style={{ padding: space[4] }}>
          <Notice tone="peligro">No se pudo cargar el catálogo. Revisá la conexión y volvé a intentar.</Notice>
        </View>
      ) : (
        <FlatList
          key={`columnas-${columnas}`}
          data={cat.productos}
          numColumns={columnas}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={columnas > 1 ? { gap: space[3] } : undefined}
          contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] }}
          onEndReached={cat.cargarMas}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center', marginTop: space[8] }]}>
              No hay productos que coincidan con la búsqueda.
            </Text>
          }
          ListFooterComponent={cat.isFetchingNextPage ? <ActivityIndicator color={c.brandInk} /> : null}
          renderItem={({ item }) => (
            <ProductoCard
              producto={item}
              disponible={cat.disponible.get(item.id)}
              grilla={grilla}
              seleccionado={dosPaneles && seleccion === item.id}
              onPress={() => { cancelarEscaneo(); setSeleccion(item.id) }}
            />
          )}
        />
      )}
    </View>
  )

  return (
    <RequirePermission module="MOD_STOCK" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Catálogo y stock"
          subtitle="Solo consulta"
          leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
          actions={[
            { icon: ScanBarcode, accessibilityLabel: 'Escanear código de barras', onPress: () => setEscaneando(true) },
            ...(dosPaneles
              ? []
              : [
                  {
                    icon: grilla ? List : LayoutGrid,
                    accessibilityLabel: grilla ? 'Ver como lista' : 'Ver como grilla',
                    onPress: () => setGrilla((g) => !g),
                  },
                ]),
          ]}
        />
        <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              height: space[12],
              borderRadius: radii.campo,
              backgroundColor: c.surface,
              paddingHorizontal: space[3],
            }}
          >
            <Search size={20} color={c.textSecondary} />
            <TextInput
              value={cat.busqueda}
              onChangeText={(texto) => { cancelarEscaneo(); cat.setBusqueda(texto) }}
              placeholder="Buscar por código o nombre"
              placeholderTextColor={c.textSecondary}
              accessibilityLabel="Buscar por código o nombre"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={[typeScale.cuerpo, { flex: 1, color: c.text, paddingVertical: 0 }]}
            />
          </View>
        </View>
        {avisoEscaneo ? (
          <View style={{ padding: space[4], paddingBottom: 0 }}>
            <Notice tone={avisoEscaneo.tone}>{avisoEscaneo.texto}</Notice>
          </View>
        ) : null}

        {dosPaneles ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: c.border }}>{lista}</View>
            <View testID="panel-ficha" style={{ flex: 1 }}>
              {seleccion ? (
                <FichaProducto productoId={seleccion} />
              ) : (
                <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center', marginTop: space[8] }]}>
                  Elegí un producto para ver su ficha.
                </Text>
              )}
            </View>
          </View>
        ) : (
          lista
        )}

        <EscanerCodigo
          visible={escaneando}
          onClose={() => setEscaneando(false)}
          onLeido={(leido) => {
            setEscaneando(false)
            setSeleccion(null)
            escaneo.mutate(leido, { onSuccess: (p) => { if (p) setSeleccion(p.productoPadreId ?? p.id) } })
          }}
        />

        <Modal
          visible={!dosPaneles && seleccion !== null}
          animationType="slide"
          onRequestClose={() => setSeleccion(null)}
        >
          <View style={{ flex: 1, backgroundColor: c.bg }}>
            <TopBar title="Ficha de producto" leading={{ kind: 'atras', onPress: () => setSeleccion(null) }} />
            {seleccion ? <FichaProducto productoId={seleccion} /> : null}
          </View>
        </Modal>
      </View>
    </RequirePermission>
  )
}

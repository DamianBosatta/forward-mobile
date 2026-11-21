import { FlashList } from '@shopify/flash-list'
import { CeldaDeGrilla, paddingDeGrilla } from '@/core/ui/listaFlash'
import React, { memo, useCallback, useRef, useState } from 'react'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { ActivityIndicator, Modal, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { DrawerActions, useFocusEffect } from "expo-router/react-navigation"
import { useMutation } from '@tanstack/react-query'
import { LayoutGrid, List, ScanBarcode } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Notice, TopBar, useInsetInferior } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { EstadoDeConsulta } from '@/core/ui/estados'
import { esFallaDeRed, TEXTO_SIN_CONEXION } from '@/core/api/errores'
import { RequirePermission } from '@/core/ui'
import { ApiError } from '@/core/api/client'
import { buscarPorCodigoBarra } from '@/libs/api-client/productos'
import { useCatalogoConsulta } from '@/features/catalogo/hooks/useCatalogoConsulta'
import { ProductoCard } from '@/features/catalogo/components/ProductoCard'
import { FichaProducto } from '@/features/catalogo/components/FichaProducto'
import { EscanerCodigo } from '@/features/catalogo/components/EscanerCodigo'
import { SelectorLineaFamilia } from '@/features/catalogo/components/SelectorLineaFamilia'
import { BotonCatalogoPdf } from '@/features/catalogo/components/BotonCatalogoPdf'
import { DIAS_DE_NOVEDADES, filtrarPorStock } from '@/features/catalogo/lib/presentacion'
import { BusquedaBajoBarra } from '@/features/inventario/components/BusquedaBajoBarra'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/** Ancho desde el que la grilla y la ficha van lado a lado (plan §8, lámina TabCatalogoConsulta). */
const ANCHO_DOS_PANELES = 900
/** El aviso de un escaneo que falló: sin red (no llegó respuesta), código rechazado (400) u otro error. */
function falloDelEscaneo(error: Error, codigo?: string): string {
  if (!(error instanceof ApiError)) return `${TEXTO_SIN_CONEXION}: no se pudo buscar el código ${codigo}. Volvé a escanear cuando haya señal.`
  return error.status === 400 ? `El código ${codigo} no es válido.` : `No se pudo buscar el código ${codigo}. Volvé a intentar.`
}

/** Catálogo, solo consulta (láminas CatalogoConsulta, FichaProducto y TabCatalogoConsulta). */
type PropsProducto = Omit<React.ComponentProps<typeof ProductoCard>, 'onPress'> & { onAbrir: (id: string) => void }

/** Fila memoizada: no se vuelve a pintar mientras el producto, su stock y `onAbrir` no cambien. */
const FilaProducto = memo(function FilaProducto({ onAbrir, ...tarjeta }: PropsProducto) {
  return <ProductoCard {...tarjeta} onPress={() => onAbrir(tarjeta.producto.id)} />
})

function CatalogoConsulta() {
  const insetInferior = useInsetInferior()
  const navigation = useNavigation()
  const router = useRouter()
  const c = useColors()
  const { width } = useResponsive()
  const dosPaneles = width >= ANCHO_DOS_PANELES
  const [grillaElegida, setGrilla] = useState(false)
  const grilla = dosPaneles || grillaElegida
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const cat = useCatalogoConsulta()
  // Sin señal: con lo guardado se sigue mostrando la lista y un aviso; sin nada, el estado "sin conexión" (R16).
  const catSinRed = cat.isError && esFallaDeRed(cat.error)
  const [soloConStock, setSoloConStock] = useFiltroPersistente('catalogo.soloConStock', false)
  const productos = filtrarPorStock(cat.productos, cat.disponible, soloConStock)
  const columnas = grilla ? 2 : 1
  const [escaneando, setEscaneando] = useState(false)
  // Código leído: el producto con ese código exacto; una fragancia abre la ficha de su línea. Sin red
  // falla enseguida (`always`): no queda en pausa para abrir una ficha cuando vuelva la señal.
  // Otro escaneo, abrir el escáner, tocar una tarjeta, tipear o salir dejan sin efecto el escaneo en curso.
  const corte = useRef<AbortController | null>(null)
  const escaneo = useMutation({
    mutationFn: (codigo: string) => {
      corte.current?.abort()
      corte.current = new AbortController()
      return buscarPorCodigoBarra(codigo, corte.current.signal)
    },
    networkMode: 'always',
    // Es una búsqueda: no cambia nada que resuma Inicio.
    meta: { noRefrescaInicio: true },
  })
  const { reset } = escaneo
  const cancelarEscaneo = useCallback(() => { corte.current?.abort(); reset() }, [reset])
  // El menú lateral deja la pantalla montada: salir es el blur, no el desmontaje.
  useFocusEffect(useCallback(() => cancelarEscaneo, [cancelarEscaneo]))
  const codigo = escaneo.variables
  const avisoEscaneo = escaneo.isPending ? { tone: 'info' as const, texto: `Buscando el código ${codigo}…` }
    : escaneo.error ? { tone: 'peligro' as const, texto: falloDelEscaneo(escaneo.error, codigo) }
    : escaneo.isSuccess && !escaneo.data ? { tone: 'advertencia' as const, texto: `No hay ningún producto con el código ${codigo}.` } : null

  // "Ver stock por depósito" de la ficha: abre la pantalla Stock buscando ese producto por código.
  const verStock = (codigoProducto: string) => {
    setSeleccion(null)
    router.push({ pathname: '/(tabs)/inventario/stock', params: { busqueda: codigoProducto } })
  }

  // La ficha del producto no trae la marca de novedad: sale de la tarjeta que se tocó.
  const novedadDe = (id: string) => cat.productos.find((p) => p.id === id)

  const abrirProducto = useCallback((id: string) => { cancelarEscaneo(); setSeleccion(id) }, [cancelarEscaneo])
  const renderProducto = useCallback(({ item }: { item: (typeof productos)[number] }) => (
    <CeldaDeGrilla columnas={columnas} espacio={space[3]}>
      <FilaProducto
        producto={item}
        disponible={cat.disponible.get(item.id)}
        grilla={grilla}
        seleccionado={dosPaneles && seleccion === item.id}
        onAbrir={abrirProducto}
      />
    </CeldaDeGrilla>
  ), [columnas, cat.disponible, grilla, dosPaneles, seleccion, abrirProducto])

  const lista = (
    <View style={{ flex: 1 }}>
      <View
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingHorizontal: space[5] }}
      >
        <Text style={[typeScale.cuerpoDestacado, { color: c.text, flexShrink: 1 }]}>
          {cat.totalCount != null ? `${productos.length} de ${cat.totalCount} productos` : ' '}
        </Text>
        <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{`Novedades: ${DIAS_DE_NOVEDADES} días`}</Text>
      </View>
      {/* Sin red: con lo guardado sigue la lista y un aviso; sin nada, la pantalla entera. Otro error: la pantalla entera. */}
      <EstadoDeConsulta
        cargando={cat.isLoading}
        error={cat.isError && (!catSinRed || cat.productos.length === 0) ? cat.error : undefined}
        tituloError="No pudimos cargar el catálogo"
        textoError="No se pudo cargar el catálogo. Revisá la conexión y volvé a intentar."
        tituloVacio="No hay productos que coincidan con la búsqueda."
        onReintentar={() => { void cat.refetch() }}
      >
        <FlashList
          ListHeaderComponent={catSinRed ? <View style={{ paddingBottom: space[3] }}><Notice tone="advertencia">{textoSinConexion(cat.dataUpdatedAt)}</Notice></View> : undefined}
          key={`columnas-${columnas}`}
          data={productos}
          numColumns={columnas}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingTop: space[4], paddingHorizontal: paddingDeGrilla(space[4], columnas, space[3]), paddingBottom: space[12] + insetInferior }}
          onEndReached={cat.cargarMas}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<EstadoDeConsulta cargando={false} vacio tituloError="No pudimos cargar el catálogo" tituloVacio="No hay productos que coincidan con la búsqueda." />}
          ListFooterComponent={cat.isFetchingNextPage ? <ActivityIndicator color={c.brandInk} /> : undefined}
          renderItem={renderProducto}
        />
      </EstadoDeConsulta>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Catálogo"
        subtitle="Solo consulta"
        leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
        actions={[
          { icon: ScanBarcode, accessibilityLabel: 'Escanear código de barras', onPress: () => { cancelarEscaneo(); setEscaneando(true) } },
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
      <BusquedaBajoBarra value={cat.busqueda} onChangeText={(texto) => { cancelarEscaneo(); cat.setBusqueda(texto) }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }}>
        <FiltroChip label="Con stock" activo={soloConStock} onPress={() => setSoloConStock((v) => !v)} />
        <FiltroChip label="Con oferta" activo={cat.soloConOferta} onPress={() => cat.setSoloConOferta((v) => !v)} />
        <SelectorLineaFamilia categoriaId={cat.categoriaId} onChange={cat.setCategoriaId} />
        <BotonCatalogoPdf
          busqueda={cat.busqueda}
          soloConStock={soloConStock}
          conOferta={cat.soloConOferta}
          categoriaId={cat.categoriaId}
          totalCount={cat.totalCount}
          puedeElegirLista={cat.puedeElegirLista}
          listaFija={cat.listaFija}
        />
      </View>
      {avisoEscaneo ? (
        <View style={{ padding: space[4], paddingBottom: 0 }}>
          <Notice tone={avisoEscaneo.tone}>{avisoEscaneo.texto}</Notice>
        </View>
      ) : null}

      {dosPaneles ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>{lista}</View>
          <View testID="panel-ficha" style={{ flex: 1 }}>
            {seleccion ? (
              <FichaProducto productoId={seleccion} onVerStock={verStock} novedad={novedadDe(seleccion)} />
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
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <TopBar title="Ficha de producto" leading={{ kind: 'atras', onPress: () => setSeleccion(null) }} />
          {seleccion ? <FichaProducto productoId={seleccion} onVerStock={verStock} novedad={novedadDe(seleccion)} /> : null}
        </View>
      </Modal>
    </View>
  )
}

/** El catálogo se habilita con MOD_CATALOGO (no con Stock). La consulta vive adentro: sin permiso no se pide nada. */
export default function CatalogoConsultaScreen() {
  useRefrescarAlEnfocar()
  return (
    <RequirePermission module="MOD_CATALOGO" action="read" mode="screen">
      <CatalogoConsulta />
    </RequirePermission>
  )
}

import React, { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Text, TextInput, View } from 'react-native'
import { useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import { useMutation } from '@tanstack/react-query'
import { LayoutGrid, List, ScanBarcode, Search } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Notice, Segmented, TopBar } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { RequirePermission } from '@/core/ui'
import { ApiError } from '@/core/api/client'
import { buscarPorCodigoBarra } from '@/libs/api-client/productos'
import { useCatalogoConsulta } from '@/features/catalogo/hooks/useCatalogoConsulta'
import { ProductoCard } from '@/features/catalogo/components/ProductoCard'
import { FichaProducto } from '@/features/catalogo/components/FichaProducto'
import { EscanerCodigo } from '@/features/catalogo/components/EscanerCodigo'
import { filtrarPorStock } from '@/features/catalogo/lib/presentacion'
import { StockPorDeposito } from '@/features/inventario/components/StockPorDeposito'

/** Ancho desde el que la grilla y la ficha van lado a lado (plan §8, lámina TabCatalogoConsulta). */
const ANCHO_DOS_PANELES = 900
/** Desde acá el stock se ve como tabla (lámina TabStock). */
const ANCHO_TABLET = 600

type Vista = 'catalogo' | 'stock'

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
  const [vista, setVista] = useState<Vista>('catalogo')
  const [soloConStock, setSoloConStock] = useState(false)
  const [stockBusqueda, setStockBusqueda] = useState('')
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

  // "Ver stock por depósito" de la ficha: pasa a Stock buscando ese producto por código.
  const verStock = (codigoProducto: string) => {
    setSeleccion(null)
    setStockBusqueda(codigoProducto)
    setVista('stock')
  }

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
          {cat.totalCount != null ? `MOSTRANDO ${productos.length} DE ${cat.totalCount}` : ' '}
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
          data={productos}
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
          title={vista === 'catalogo' ? 'Catálogo' : 'Stock'}
          subtitle="Solo consulta"
          leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
          actions={vista === 'stock' ? [] : [
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
        <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[3], gap: space[3] }}>
          <Segmented
            accessibilityLabel="Vista"
            value={vista}
            onChange={(v) => { cancelarEscaneo(); setVista(v) }}
            options={[{ value: 'catalogo', label: 'Catálogo' }, { value: 'stock', label: 'Stock' }]}
          />
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
              value={vista === 'catalogo' ? cat.busqueda : stockBusqueda}
              onChangeText={(texto) => { cancelarEscaneo(); if (vista === 'catalogo') cat.setBusqueda(texto); else setStockBusqueda(texto) }}
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
        {vista === 'catalogo' ? (
          <View style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }}>
            <FiltroChip label="Con stock" activo={soloConStock} onPress={() => setSoloConStock((v) => !v)} />
          </View>
        ) : null}
        {vista === 'catalogo' && avisoEscaneo ? (
          <View style={{ padding: space[4], paddingBottom: 0 }}>
            <Notice tone={avisoEscaneo.tone}>{avisoEscaneo.texto}</Notice>
          </View>
        ) : null}

        {vista === 'stock' ? (
          <StockPorDeposito busqueda={stockBusqueda} tablet={width >= ANCHO_TABLET} />
        ) : dosPaneles ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: c.border }}>{lista}</View>
            <View testID="panel-ficha" style={{ flex: 1 }}>
              {seleccion ? (
                <FichaProducto productoId={seleccion} onVerStock={verStock} />
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
            {seleccion ? <FichaProducto productoId={seleccion} onVerStock={verStock} /> : null}
          </View>
        </Modal>
      </View>
    </RequirePermission>
  )
}

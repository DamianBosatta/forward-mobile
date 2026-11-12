import React, { useState, useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { Pressable, Text, View } from 'react-native'
import { Check, Lock } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Notice, Segmented } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { RequirePermission } from '@/core/ui'
import { getCatalogoPdfUrl, type FormatoCatalogoPdf } from '@/libs/api-client/productos'
import { useListasPrecio } from '@/libs/api-client/catalogo'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { DIAS_DE_NOVEDADES, VENTANAS_DE_NOVEDADES, novedadesDesde } from '../lib/presentacion'
import { DESCUENTOS_DISPONIBLES, DESCUENTOS_POR_DEFECTO, paramsDeDescuentos } from '../lib/listaDePrecios'

interface Props {
  busqueda: string
  soloConStock: boolean
  conOferta?: boolean
  categoriaId?: string
  /** Productos con los filtros de la pantalla; con 0 no hay nada que generar (salvo el Informativo, que no filtra). */
  totalCount?: number
  /** Quien puede elegir la lista de precios ve el selector; el resto ve `listaFija`. */
  puedeElegirLista: boolean
  /** La lista que se le aplica a quien no elige; `null` = precio base. */
  listaFija: string | null
}

type Ventana = `${(typeof VENTANAS_DE_NOVEDADES)[number]}` | 'ninguna'

const FORMATOS: { value: FormatoCatalogoPdf; label: string }[] = [
  { value: 'Lista', label: 'Lista' },
  { value: 'Tarjeta', label: 'Tarjeta' },
  { value: 'Informativo', label: 'Informativo' },
]

const AYUDA_FORMATO: Record<FormatoCatalogoPdf, string> = {
  Lista: 'Compacto, con la escala de descuentos.',
  Tarjeta: 'Foto grande y precio, para mostrar.',
  Informativo: 'Foto, marca, nombre y cómo viene. Sin precios.',
}

const VENTANAS: { value: Ventana; label: string }[] = [
  ...VENTANAS_DE_NOVEDADES.map((d) => ({ value: `${d}` as Ventana, label: `${d} días` })),
  { value: 'ninguna', label: 'Sin marcas' },
]

const SIN_CONEXION = 'Sin conexión: el catálogo se arma en el servidor. Probá cuando vuelva la señal.'
const SIN_PRODUCTOS = 'No hay productos para generar con estos filtros.'

/**
 * Exporta el catálogo a PDF y abre el panel de compartir del sistema (WhatsApp, mail…). Mismas opciones que la web
 * (catalogo-client.tsx + OpcionesPdf.tsx): formato Lista, Tarjeta o Informativo; novedades; lista de precios; y
 * descuentos a imprimir, solo en Lista. El Informativo no lleva precios ni usa los filtros de la pantalla.
 * Lo habilita MOD_CATALOGO, el mismo permiso que pide GET /catalogo/pdf.
 */
export function BotonCatalogoPdf(props: Props) {
  return (
    <RequirePermission module="MOD_CATALOGO" action="read">
      <ExportarCatalogoPdf {...props} />
    </RequirePermission>
  )
}

function ExportarCatalogoPdf({ busqueda, soloConStock, conOferta, categoriaId, totalCount, puedeElegirLista, listaFija }: Props) {
  const c = useColors()
  // El estado de red que app/_layout le pasa a React Query desde NetInfo (el mismo patrón que la consola del chofer).
  const enLinea = useSyncExternalStore((cb) => onlineManager.subscribe(cb), () => onlineManager.isOnline())
  const [abierta, setAbierta] = useState(false)
  const [formato, setFormato] = useState<FormatoCatalogoPdf>('Lista')
  const [ventana, setVentana] = useState<Ventana>(`${DIAS_DE_NOVEDADES}` as Ventana)
  const [descuentos, setDescuentos] = useState<number[]>([...DESCUENTOS_POR_DEFECTO])
  const [listaPrecioId, setListaPrecioId] = useState('')
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const informativo = formato === 'Informativo'
  const listas = useListasPrecio(abierta && !informativo && puedeElegirLista)
  const visibles = (listas.data ?? []).filter((l) => l.activa || l.id === listaPrecioId)

  const sinRed = !enLinea
  const sinProductos = !informativo && totalCount === 0
  const motivo = sinRed ? SIN_CONEXION : sinProductos ? SIN_PRODUCTOS : null

  const alternarDescuento = (d: number) =>
    setDescuentos((previos) => (previos.includes(d) ? previos.filter((x) => x !== d) : [...previos, d]).sort((a, b) => a - b))

  const generar = async () => {
    if (motivo || generando) return
    setGenerando(true)
    setError(null)
    const url = getCatalogoPdfUrl({
      search: busqueda,
      soloDisponibles: soloConStock,
      conOferta,
      categoriaId,
      listaPrecioId: puedeElegirLista ? listaPrecioId || undefined : undefined,
      formato,
      novedadesDesde: ventana === 'ninguna' ? undefined : novedadesDesde(Number(ventana)),
      ...(formato === 'Lista' ? paramsDeDescuentos(descuentos) : {}),
    })
    const r = await sharePdf(url, `catalogo-${novedadesDesde(0)}.pdf`)
    setGenerando(false)
    if (r.ok) setAbierta(false)
    else setError(r.message)
  }

  const titulo = [typeScale.secundario, { color: c.text, fontFamily: FONT.semibold, fontWeight: '600' as const }]
  const ayuda = [typeScale.secundario, { color: c.textSecondary }]

  return (
    <>
      <Button label="Exportar PDF" variant="secundario" onPress={() => setAbierta(true)} />
      <BottomSheet visible={abierta} onClose={() => setAbierta(false)} accessibilityLabel="Exportar el catálogo a PDF">
        <Text style={[typeScale.titulo, { color: c.text }]}>Exportar catálogo</Text>

        <View style={{ gap: space[2] }}>
          <Text style={titulo}>Formato</Text>
          <Segmented options={FORMATOS} value={formato} onChange={setFormato} accessibilityLabel="Formato del catálogo" />
          <Text style={ayuda}>{AYUDA_FORMATO[formato]}</Text>
        </View>

        {informativo ? (
          <View style={{ gap: space[1] }}>
            <Text style={titulo}>Catálogo informativo</Text>
            <Text style={ayuda}>
              Sale con todos los productos activos: foto, marca, nombre y cómo viene. No lleva precios, ofertas, novedades
              ni descuentos, y no usa los filtros de la pantalla.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ gap: space[2] }}>
              <Text style={titulo}>Novedades desde</Text>
              <Segmented options={VENTANAS} value={ventana} onChange={setVentana} accessibilityLabel="Novedades desde" />
              <Text style={ayuda}>
                {ventana === 'ninguna'
                  ? 'El PDF sale sin marcas de novedades.'
                  : `Marca lo nuevo, los precios cambiados y lo que no tiene stock de los últimos ${ventana} días.`}
              </Text>
            </View>

            <View style={{ gap: space[2] }}>
              <Text style={titulo}>Lista de precios</Text>
              {puedeElegirLista ? (
                <>
                  <View accessibilityLabel="Lista de precios" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                    <ChipDeOpcion rol="radio" label="Sin lista (precio base)" elegido={listaPrecioId === ''} onPress={() => setListaPrecioId('')} />
                    {visibles.map((l) => (
                      <ChipDeOpcion
                        key={l.id}
                        rol="radio"
                        label={l.activa ? l.nombre : `${l.nombre} (desactivada)`}
                        elegido={listaPrecioId === l.id}
                        onPress={() => setListaPrecioId(l.id)}
                      />
                    ))}
                  </View>
                  <Text style={ayuda}>
                    {listas.isError
                      ? 'No se pudieron cargar las listas: el PDF sale con el precio base.'
                      : 'El PDF sale con los precios de esta lista y la lleva escrita en el encabezado.'}
                  </Text>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Lock size={16} color={c.textSecondary} />
                    <Text style={titulo}>{listaFija ?? 'Precio base'}</Text>
                  </View>
                  <Text style={ayuda}>
                    {listaFija
                      ? 'Es la lista que tenés asignada. El catálogo sale siempre con esta.'
                      : 'No tenés una lista asignada: el catálogo sale con el precio base.'}
                  </Text>
                </>
              )}
            </View>

            <View style={{ gap: space[2] }}>
              <Text style={titulo}>Descuentos a imprimir</Text>
              {formato === 'Lista' ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                    {DESCUENTOS_DISPONIBLES.map((d) => (
                      <ChipDeOpcion key={d} rol="checkbox" label={`−${d} %`} elegido={descuentos.includes(d)} onPress={() => alternarDescuento(d)} />
                    ))}
                  </View>
                  <Text style={ayuda}>
                    {descuentos.length === 0
                      ? 'Sin descuentos: sale solo el precio de lista.'
                      : `Sale el precio de lista y ${descuentos.map((d) => `−${d} %`).join(', ')}.`}
                  </Text>
                </>
              ) : (
                <Text style={ayuda}>La tarjeta muestra solo el precio, sin escala de descuentos.</Text>
              )}
            </View>
          </>
        )}

        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Generar catálogo" loading={generando} disabled={motivo !== null} onPress={() => { void generar() }} />
        {motivo ? <MotivoDeshabilitado>{motivo}</MotivoDeshabilitado> : null}
      </BottomSheet>
    </>
  )
}

/**
 * Opción en pastilla de la hoja (una lista de precios, un descuento): 44 pt de alto, la elegida con tilde además del
 * color. `FiltroChip` mide 36 y es un filtro de pantalla, no una opción de un formulario.
 */
function ChipDeOpcion({ label, elegido, rol, onPress }: { label: string; elegido: boolean; rol: 'radio' | 'checkbox'; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={rol}
      accessibilityLabel={label}
      accessibilityState={{ checked: elegido }}
      android_ripple={{ color: c.brandSoft }}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        paddingHorizontal: space[3],
        borderRadius: radii.pastilla,
        borderWidth: 1,
        borderColor: elegido ? c.brand : c.border,
        backgroundColor: elegido ? c.brandSoft : c.surface,
        overflow: 'hidden',
      }}
    >
      {elegido ? <Check size={16} color={c.brandInk} /> : null}
      <Text style={[typeScale.secundario, { color: elegido ? c.brandInk : c.text }]}>{label}</Text>
    </Pressable>
  )
}

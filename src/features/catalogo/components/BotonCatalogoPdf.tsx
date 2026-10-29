import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Notice, Segmented, StatusChip } from '@/core/ui/fw'
import { getCatalogoPdfUrl, type FormatoCatalogoPdf } from '@/libs/api-client/productos'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { DIAS_DE_NOVEDADES, VENTANAS_DE_NOVEDADES, novedadesDesde } from '../lib/presentacion'

interface Props {
  busqueda: string
  soloConStock: boolean
  conOferta?: boolean
  categoriaId?: string
}

type Ventana = `${(typeof VENTANAS_DE_NOVEDADES)[number]}`

const FORMATOS: { value: FormatoCatalogoPdf; label: string }[] = [
  { value: 'Tarjeta', label: 'Tarjeta' },
  { value: 'Lista', label: 'Lista' },
]

const AYUDA_FORMATO: Record<FormatoCatalogoPdf, string> = {
  Tarjeta: 'Foto grande, para mostrar.',
  Lista: 'Compacto, para precios.',
}

const VENTANAS = VENTANAS_DE_NOVEDADES.map((d) => ({ value: `${d}` as Ventana, label: `${d} días` }))

/**
 * Genera el PDF del catálogo con los filtros que se ven en pantalla y abre el panel de compartir (lámina Exportar a
 * PDF): antes se elige el formato (tarjeta o lista) y desde cuándo se marcan las novedades.
 */
export function BotonCatalogoPdf({ busqueda, soloConStock, conOferta, categoriaId }: Props) {
  const c = useColors()
  const [abierta, setAbierta] = useState(false)
  const [formato, setFormato] = useState<FormatoCatalogoPdf>('Tarjeta')
  const [ventana, setVentana] = useState<Ventana>(`${DIAS_DE_NOVEDADES}` as Ventana)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compartir = async () => {
    setGenerando(true)
    setError(null)
    const url = getCatalogoPdfUrl({
      search: busqueda,
      soloDisponibles: soloConStock,
      conOferta,
      categoriaId,
      formato,
      novedadesDesde: novedadesDesde(Number(ventana)),
    })
    const r = await sharePdf(url, `catalogo-${novedadesDesde(0)}.pdf`)
    setGenerando(false)
    if (r.ok) setAbierta(false)
    else setError(r.message)
  }

  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  return (
    <View style={{ gap: space[2] }}>
      <Button label="Compartir catálogo en PDF" variant="secundario" onPress={() => setAbierta(true)} />
      <BottomSheet visible={abierta} onClose={() => setAbierta(false)} accessibilityLabel="Exportar el catálogo a PDF">
        <Text style={[typeScale.titulo, { color: c.text }]}>Exportar a PDF</Text>
        <View style={{ gap: space[2] }}>
          <Text style={secundario}>Formato</Text>
          <Segmented options={FORMATOS} value={formato} onChange={setFormato} accessibilityLabel="Formato" />
          <Text style={secundario}>{AYUDA_FORMATO[formato]}</Text>
        </View>
        <View style={{ gap: space[2] }}>
          <Text style={secundario}>Novedades desde</Text>
          <Segmented options={VENTANAS} value={ventana} onChange={setVentana} accessibilityLabel="Novedades desde" />
          <Text style={secundario}>{`Productos dados de alta y precios cambiados en los últimos ${ventana} días.`}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <StatusChip estado="entregado" label="Nuevo" />
          <StatusChip estado="porAutorizar" label="Precio ▲▼ %" />
          <StatusChip estado="anulado" label="Sin stock" />
        </View>
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label={`Generar PDF en ${formato.toLowerCase()}`} loading={generando} onPress={() => { void compartir() }} />
      </BottomSheet>
    </View>
  )
}

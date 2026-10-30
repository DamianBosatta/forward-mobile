import React, { useState } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import { useFichaCatalogo } from '@/libs/api-client/catalogo'
import { getFullImageUrl } from '@/libs/api-client/media'
import { useDepositoDeConsulta } from '../hooks/useDepositoDeConsulta'
import { chipDeStock, textoUnidadDeVenta } from '../lib/presentacion'
import { compartirFoto } from '../lib/compartirFoto'

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2], minHeight: 28 }}>
      <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>{label}</Text>
      <Text style={[fuerte ? typeScale.cuerpoDestacado : typeScale.cuerpo, importe, { color: c.text }]}>{valor}</Text>
    </View>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] }}>
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{titulo}</Text>
      {children}
    </View>
  )
}

/**
 * Ficha de producto (láminas FichaProducto y ModProducto). Como en la web, el catálogo no muestra cantidades ni
 * costos: solo si hay stock. Las cantidades por depósito viven en la vista Stock, a la que lleva `onVerStock`.
 */
export function FichaProducto({ productoId, onVerStock }: { productoId: string; onVerStock?: (codigo: string) => void }) {
  const c = useColors()
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  // The chip answers for one unit, same as the card. The server also tells whether the minimum sale (a box) fits.
  const depositoId = useDepositoDeConsulta()
  const { data: p, isLoading, isError } = useFichaCatalogo(productoId, depositoId)
  const variantes = p?.variantes ?? []

  if (isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (isError || !p) return <View style={{ padding: space[4] }}><Notice tone="peligro">No se pudo cargar el producto.</Notice></View>

  const ventaMinima = p.ventaMinimaUnidades
  const chip = chipDeStock(p.disponible)
  const noAlcanzaCaja = ventaMinima > 1 && p.disponible && !p.disponibleVentaMinima
  const foto = getFullImageUrl(p.imageUrl)
  const encabezado = [p.codigoPropio, p.marca, p.categoriaPathCompleto].filter(Boolean).join(' · ')

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      <View style={{ height: 200, borderRadius: radii.tarjeta, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {foto ? (
          <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={`Foto de ${p.nombre}`} />
        ) : (
          <Package size={56} color={c.textSecondary} strokeWidth={1.4} />
        )}
      </View>

      {foto ? (
        <View style={{ gap: space[2] }}>
          <Button
            label="Mandar foto"
            variant="secundario"
            onPress={() => { void compartirFoto(foto, p.codigoPropio).then((r) => setErrorFoto(r.ok ? null : r.message)) }}
          />
          {errorFoto ? <Notice tone="peligro">{errorFoto}</Notice> : null}
        </View>
      ) : null}

      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>{encabezado}</Text>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
        </View>
        <Text style={[typeScale.titulo, { color: c.text }]}>{p.nombre}</Text>
      </View>

      <View style={{ gap: space[1] }}>
        <Fila label="Precio de lista por unidad" valor={formatImporte(p.precioVenta)} fuerte />
        {p.precioConOferta != null ? <Fila label="Precio de oferta" valor={formatImporte(p.precioConOferta)} fuerte /> : null}
      </View>

      <Notice tone="info">{textoUnidadDeVenta(p.ventaMinimaUnidades)}</Notice>
      {noAlcanzaCaja ? <Notice tone="advertencia">{`No alcanza para la venta mínima (caja de ${ventaMinima})`}</Notice> : null}

      {p.esPadreDeVariantes && variantes.length > 0 ? (
        <Seccion titulo={`Fragancias (${variantes.length})`}>
          {variantes.map((v) => {
            const cv = chipDeStock(v.disponible)
            return (
              <View key={v.productoId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, gap: space[2] }}>
                <Text style={[typeScale.cuerpo, { color: c.text, flexShrink: 1 }]}>{v.fraganciaNombre ?? v.nombre}</Text>
                {cv ? <StatusChip estado={cv.estado} label={cv.label} /> : null}
              </View>
            )
          })}
        </Seccion>
      ) : null}

      {onVerStock ? (
        <Button label="Ver stock por depósito" variant="secundario" onPress={() => onVerStock(p.codigoPropio)} />
      ) : null}

      <Seccion titulo="Datos">
        <Fila label="Código" valor={p.codigoPropio} />
        {p.codigoBarra ? <Fila label="Código de barras" valor={p.codigoBarra} /> : null}
        {p.marca ? <Fila label="Marca" valor={p.marca} /> : null}
        {p.categoriaPathCompleto ? <Fila label="Categoría" valor={p.categoriaPathCompleto} /> : null}
      </Seccion>
    </ScrollView>
  )
}

import React, { useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronRight, Package } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import { useFichaCatalogo } from '@/libs/api-client/catalogo'
import { getFullImageUrl } from '@/libs/api-client/media'
import { useDepositoDeConsulta } from '../hooks/useDepositoDeConsulta'
import { chipDeStock, chipDeTarjeta, formasDeVenta, textoVariacion, type ProductoDeTarjeta } from '../lib/presentacion'
import { compartirFoto } from '../lib/compartirFoto'

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  const c = useColors()
  // A long value (a category path) pushed the label down to one letter per line on Android; it stacks instead.
  const apilada = valor.length > 24
  return (
    <View
      style={
        apilada
          ? { gap: space[1], minHeight: 28 }
          : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2], minHeight: 28 }
      }
    >
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[fuerte ? typeScale.cuerpoDestacado : typeScale.cuerpo, importe, { color: c.text, flexShrink: 1 }]}>{valor}</Text>
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
export function FichaProducto({
  productoId,
  onVerStock,
  novedad,
}: {
  productoId: string
  onVerStock?: (codigo: string) => void
  /** La marca de novedad y el precio anterior vienen de la tarjeta del listado: la ficha del producto no los trae. */
  novedad?: Pick<ProductoDeTarjeta, 'novedad' | 'precioAnterior' | 'variacionPorcentaje'>
}) {
  const c = useColors()
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  // The chip answers for one unit, same as the card. The server also tells whether the minimum sale (a box) fits.
  const depositoId = useDepositoDeConsulta()
  const { data: p, isLoading, isError } = useFichaCatalogo(productoId, depositoId)
  const variantes = p?.variantes ?? []

  if (isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (isError || !p) return <View style={{ padding: space[4] }}><Notice tone="peligro">No se pudo cargar el producto.</Notice></View>

  const ventaMinima = p.ventaMinimaUnidades
  const chip = chipDeTarjeta(novedad?.novedad, p.disponible)
  const variacion = textoVariacion(novedad?.variacionPorcentaje)
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

      {/* Lámina catalogo-ficha: el precio y "Cómo se vende" van juntos en una sola tarjeta. */}
      <View testID="ficha-precio-tarjeta" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, padding: space[4], gap: space[3] }}>
        <View style={{ gap: space[1] }}>
          <Fila label="Precio de lista por unidad" valor={formatImporte(p.precioVenta)} fuerte />
          {variacion ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: space[2] }}>
              {novedad?.precioAnterior != null ? (
                <Text style={[typeScale.secundario, importe, { color: c.textSecondary }]}>{`antes ${formatImporte(novedad.precioAnterior)}`}</Text>
              ) : null}
              <Text style={[typeScale.etiqueta, { color: c.chip.porAutorizar.text }]}>{variacion}</Text>
            </View>
          ) : null}
          {p.precioConOferta != null ? <Fila label="Precio de oferta" valor={formatImporte(p.precioConOferta)} fuerte /> : null}
        </View>
        <Text accessibilityRole="header" style={[typeScale.secundario, { color: c.textSecondary }]}>Cómo se vende</Text>
        <View style={{ borderRadius: radii.campo, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
          {formasDeVenta(p).map((f, i) => (
            <View
              key={f.clave}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                minHeight: 48,
                paddingHorizontal: space[3],
                paddingVertical: space[2],
                backgroundColor: f.destacada ? c.brandSoft : 'transparent',
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <Text style={[f.destacada ? typeScale.cuerpoDestacado : typeScale.cuerpo, { flex: 1, color: f.destacada ? c.brandInk : c.text }]}>{f.label}</Text>
              <Text style={[typeScale.secundario, importe, { color: f.destacada ? c.brandInk : c.textSecondary }]}>{`${f.unidades} u.`}</Text>
              <Text style={[typeScale.cuerpoDestacado, importe, { minWidth: 104, textAlign: 'right', color: c.text }]}>{formatImporte(f.precio)}</Text>
            </View>
          ))}
        </View>
      </View>
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
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Ver stock en vivo de este producto"
          onPress={() => onVerStock(p.codigoPropio)}
          android_ripple={{ color: c.surface2 }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}
        >
          <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>Ver stock en vivo de este producto</Text>
          <ChevronRight size={20} color={c.brandInk} />
        </Pressable>
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

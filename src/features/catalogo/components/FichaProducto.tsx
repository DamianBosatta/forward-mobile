import React from 'react'
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import { Package, Lock } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip, formatImporte } from '@/core/ui/fw'
import type { UltimaCompraProducto } from '@/libs/api-client/types'
import { useProducto, useVariantesProducto } from '@/libs/api-client/productos'
import { useDisponibilidad, useStock } from '@/libs/api-client/stock'
import { getFullImageUrl } from '@/libs/api-client/media'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { canViewStock } from '@/features/ventas/lib/descuentos'
import { useDepositoDeConsulta } from '../hooks/useDepositoDeConsulta'
import { chipDeStock, formatPorcentaje, formatVariacion, textoUltimaCompra, textoUnidadDeVenta } from '../lib/presentacion'

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2], minHeight: 28 }}>
      <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>{label}</Text>
      <Text style={[fuerte ? typeScale.cuerpoDestacado : typeScale.cuerpo, importe, { color: c.text }]}>{valor}</Text>
    </View>
  )
}

/**
 * Última compra del producto, en el bloque de costos (forward-system #894). La variación contra la compra
 * anterior lleva signo y color: subir el costo es malo (rojo), bajarlo es bueno (verde); sin variación, sin renglón.
 */
function UltimaCompra({ compra }: { compra: UltimaCompraProducto }) {
  const c = useColors()
  const variacion = compra.variacionCostoPorcentaje
  const color =
    variacion == null || Math.abs(variacion) < 0.05
      ? c.textSecondary
      : variacion > 0
        ? c.chip.anulado.text
        : c.chip.entregado.text
  return (
    <View style={{ gap: space[1], paddingVertical: space[1] }}>
      <Text style={[typeScale.cuerpo, { color: c.text }]}>{textoUltimaCompra(compra)}</Text>
      {variacion != null ? (
        <Text style={[typeScale.secundario, importe, { color }]}>{`${formatVariacion(variacion)} respecto de la compra anterior`}</Text>
      ) : null}
    </View>
  )
}

function Seccion({ titulo, aviso, children }: { titulo: string; aviso?: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] }}>
      {aviso ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Lock size={14} color={c.textSecondary} />
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{aviso}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{titulo}</Text>
      {children}
    </View>
  )
}

/**
 * Ficha de producto (lámina FichaProducto). Todo lo sensible lo decide el servidor:
 * costo y margen llegan null sin CAP_VER_COSTOS y además no se dibujan sin la capacidad;
 * las cantidades por depósito solo se piden y se dibujan con un rol que puede verlas
 * (espejo de AppRoles.StockViewingRoles, como la web).
 */
export function FichaProducto({ productoId }: { productoId: string }) {
  const c = useColors()
  const user = useAuthStore((s) => s.user)
  const veCostos = hasCapability(user?.permissions, 'CAP_VER_COSTOS')
  const veCantidades = canViewStock((user?.roles ?? []) as string[])

  const { data: p, isLoading, isError } = useProducto(productoId)
  const { data: variantes } = useVariantesProducto(productoId, !!p?.esPadreDeVariantes)
  const { data: stock } = useStock({ productoId }, { enabled: veCantidades && !!productoId })

  // El chip usa cantidad 1, igual que la tarjeta: la misma respuesta en todas partes.
  // Aparte, si se vende por caja, un segundo chequeo con la venta mínima avisa si no alcanza.
  const depositoId = useDepositoDeConsulta()
  const ventaMinima = p?.ventaMinimaUnidades ?? 1
  const idsAConsultar = p ? (p.esPadreDeVariantes ? (variantes ?? []).map((v) => v.id) : [p.id]) : []
  const { data: disponibilidad } = useDisponibilidad(
    depositoId,
    idsAConsultar.map((id) => ({ productoId: id, cantidad: 1 })),
  )
  const { data: disponibilidadCaja } = useDisponibilidad(
    depositoId,
    ventaMinima > 1 ? idsAConsultar.map((id) => ({ productoId: id, cantidad: ventaMinima })) : [],
  )
  const hay = (id: string) => disponibilidad?.find((d) => d.productoId === id)?.disponible

  if (isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (isError || !p) return <View style={{ padding: space[4] }}><Notice tone="peligro">No se pudo cargar el producto.</Notice></View>

  const chip = chipDeStock(
    p.esPadreDeVariantes ? (disponibilidad ? disponibilidad.some((d) => d.disponible) : undefined) : hay(p.id),
  )
  const noAlcanzaCaja =
    ventaMinima > 1 && chip?.estado === 'entregado' && !!disponibilidadCaja && !disponibilidadCaja.some((d) => d.disponible)
  const foto = getFullImageUrl(p.imageUrl ?? p.imageUrlLinea)
  const encabezado = [p.codigoPropio, p.marca, p.categoriaPathCompleto].filter(Boolean).join(' · ')
  const depositos = stock?.items ?? []
  // Sin CAP_VER_COSTOS el servidor manda null; aunque llegara, no se dibuja. Un servidor anterior a #894 no la manda.
  const ultimaCompra = veCostos ? p.ultimaCompra : null
  const hayCostos = veCostos && (p.precioCompraBase != null || p.margenBrutoPorcentaje != null || !!ultimaCompra)

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      <View style={{ height: 200, borderRadius: radii.tarjeta, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {foto ? (
          <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={`Foto de ${p.nombre}`} />
        ) : (
          <Package size={56} color={c.textSecondary} strokeWidth={1.4} />
        )}
      </View>

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
        {p.precioMinimoRentable != null ? (
          <>
            <Fila label="Precio mínimo" valor={formatImporte(p.precioMinimoRentable)} />
            <Text style={[typeScale.secundario, { color: c.textSecondary }]}>
              Por debajo del precio mínimo, la venta queda por autorizar.
            </Text>
          </>
        ) : null}
      </View>

      <Notice tone="info">{textoUnidadDeVenta(p.ventaMinimaUnidades)}</Notice>
      {noAlcanzaCaja ? <Notice tone="advertencia">{`No alcanza para la venta mínima (caja de ${ventaMinima})`}</Notice> : null}

      {p.esPadreDeVariantes && variantes ? (
        <Seccion titulo={`Fragancias (${variantes.length})`}>
          {variantes.map((v) => {
            const cv = chipDeStock(hay(v.id))
            return (
              <View key={v.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, gap: space[2] }}>
                <Text style={[typeScale.cuerpo, { color: c.text, flexShrink: 1 }]}>{v.fraganciaNombre ?? v.nombre}</Text>
                {cv ? <StatusChip estado={cv.estado} label={cv.label} /> : null}
              </View>
            )
          })}
        </Seccion>
      ) : null}

      {veCantidades && depositos.length > 0 ? (
        <Seccion titulo="Stock por depósito" aviso="Solo con permiso de ver cantidades">
          <Fila label="Depósito" valor="Real · Reserv. · Dispon." />
          {depositos.map((d) => (
            <Fila
              key={d.id}
              label={d.deposito}
              valor={`${d.cantidadActual} · ${d.cantidadReservada} · ${d.cantidadDisponible}`}
            />
          ))}
        </Seccion>
      ) : null}

      {hayCostos ? (
        <Seccion titulo="Costo y margen" aviso="Solo con permiso de ver costos">
          {p.precioCompraBase != null ? <Fila label="Costo por unidad" valor={formatImporte(p.precioCompraBase)} /> : null}
          {p.margenBrutoPorcentaje != null ? (
            <Fila label="Margen bruto" valor={formatPorcentaje(p.margenBrutoPorcentaje)} />
          ) : null}
          {ultimaCompra ? <UltimaCompra compra={ultimaCompra} /> : null}
        </Seccion>
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

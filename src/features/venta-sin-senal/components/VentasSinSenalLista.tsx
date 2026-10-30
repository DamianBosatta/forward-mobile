import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Clock } from 'lucide-react-native'
import { FONT, importe as cifras, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Notice, StatusChip, chipForEstado, formatImporte, type ChipInfo } from '@/core/ui/fw'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { horaDe } from '@/features/ventas/lib/agruparPorDia'
import { agrupar } from '../hooks/useVentasSinSenal'
import type { VentaEnCola } from '../lib/cola'

interface Props {
  items: VentaEnCola[]
  /** Sin señal: muestra el aviso de que se puede seguir vendiendo. */
  sinSenal: boolean
  /** "HH:MM" del catálogo que se está usando (`useHoraDelCatalogo`); null si no hay. */
  horaCatalogo: string | null
  /** Tocar una venta: abrir la enviada o el borrador, o revisar la rechazada. Sin esto las filas no se tocan. */
  onAbrir?: (v: VentaEnCola) => void
}

const EN_EL_TELEFONO: ChipInfo = { estado: 'pendiente', label: 'En cola' }
const PARA_REVISAR: ChipInfo = { estado: 'porAutorizar', label: 'Revisar' }
const EN_BORRADORES: ChipInfo = { estado: 'pendiente', label: 'En Borradores' }
const PIE = 'Si el precio cambió al enviarse, la venta queda en Borradores para que la revises.'

export function avisoSinSenal(horaCatalogo: string | null): string {
  const base = 'Sin señal. Podés seguir vendiendo: las ventas quedan en el teléfono y se mandan solas cuando vuelva la conexión.'
  return horaCatalogo ? `${base} Precios y stock de las ${horaCatalogo}.` : base
}

const tipoDe = (v: VentaEnCola) => (v.alta.tipoOperacion === 2 ? 'Pedido' : 'Presupuesto')

function chipDe(v: VentaEnCola): ChipInfo | null {
  switch (v.estado.tipo) {
    case 'esperando': return EN_EL_TELEFONO
    case 'revisar': return PARA_REVISAR
    case 'enBorradores': return EN_BORRADORES
    case 'enviada': return chipForEstado('venta', v.estado.estado)
  }
}

function detalleDe(v: VentaEnCola): string | null {
  if (v.estado.tipo === 'revisar') return v.estado.mensaje
  if (v.estado.tipo === 'enBorradores') {
    const hoy = v.estado.totalServidor == null ? '' : ` (${formatImporte(v.estado.totalServidor)})`
    return `El precio cambió: quedó en Borradores con el precio de hoy${hoy}.`
  }
  return null
}

/** V9 "Mis ventas de hoy": lo que espera en el teléfono, lo que hay que revisar y lo enviado. */
export function VentasSinSenalLista({ items, sinSenal, horaCatalogo, onAbrir }: Props) {
  const c = useColors()
  const { esperando, paraRevisar, enviadas } = agrupar(items)
  const titulo = [typeScale.secundario, { fontFamily: FONT.semibold, fontWeight: '600' as const, color: c.textSecondary }]
  const borde = c.chip.porAutorizar.text

  return (
    <View style={{ gap: space[3] }}>
      {sinSenal && <Notice tone="info">{avisoSinSenal(horaCatalogo)}</Notice>}

      {items.length === 0 && (
        <Text style={[typeScale.secundario, { color: c.textSecondary, textAlign: 'center' }]}>No hay ventas guardadas en el teléfono.</Text>
      )}

      {esperando.length > 0 && (
        <>
          <Text accessibilityRole="header" style={titulo}>{`Esperando para enviarse · ${esperando.length}`}</Text>
          <View style={{ borderRadius: radii.tarjeta, borderWidth: 1, borderStyle: 'dashed', borderColor: borde, backgroundColor: c.surface }}>
            {esperando.map((v, i) => <Fila key={v.clave} v={v} separada={i > 0} onAbrir={onAbrir} />)}
          </View>
        </>
      )}

      {paraRevisar.length > 0 && (
        <>
          <Text accessibilityRole="header" style={titulo}>{`Para revisar · ${paraRevisar.length}`}</Text>
          {paraRevisar.map((v) => <Tarjeta key={v.clave}><Fila v={v} onAbrir={onAbrir} /></Tarjeta>)}
        </>
      )}

      {enviadas.length > 0 && (
        <>
          <Text accessibilityRole="header" style={titulo}>Enviadas</Text>
          {enviadas.map((v) => <Tarjeta key={v.clave}><Fila v={v} onAbrir={onAbrir} /></Tarjeta>)}
        </>
      )}

      <Text style={[typeScale.secundario, { color: c.textSecondary, textAlign: 'center' }]}>{PIE}</Text>
    </View>
  )
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return <View style={[{ borderRadius: radii.tarjeta, backgroundColor: c.surface }, sombra]}>{children}</View>
}

function Fila({ v, separada = false, onAbrir }: { v: VentaEnCola; separada?: boolean; onAbrir?: (v: VentaEnCola) => void }) {
  const c = useColors()
  const chip = chipDe(v)
  const codigo = v.estado.tipo === 'enviada' && v.estado.codigo ? ` ${v.estado.codigo}` : ''
  const encabezado = `${tipoDe(v)}${codigo} · ${horaDe(new Date(v.encoladaEn).toISOString())}`
  const direccion = direccionDeEntrega(v.cliente)
  const nombre = nombreDelCliente(v.cliente)
  const total = formatImporte(v.visto.total)
  const detalle = detalleDe(v)
  const etiqueta = [encabezado, direccion, nombre, chip?.label, total, detalle].filter(Boolean).join(', ')
  const icono = v.estado.tipo === 'esperando'
  const contenido = (
    <>
      <View style={{ width: 44, height: 44, borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: icono ? c.chip.porAutorizar.bg : c.brandSoft }}>
        {icono ? <Clock size={20} color={c.chip.porAutorizar.text} strokeWidth={2} /> : (
          <Text style={[typeScale.secundario, { fontFamily: FONT.semibold, fontWeight: '600', color: c.brandInk }]}>
            {inicialesDeDireccion(direccion)}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>{encabezado}</Text>
          {chip && <StatusChip estado={chip.estado} label={chip.label} />}
        </View>
        <Text numberOfLines={1} style={[typeScale.cuerpoDestacado, { color: c.text }]}>{direccion}</Text>
        {nombre ? <Text numberOfLines={1} style={[typeScale.secundario, { color: c.text }]}>{nombre}</Text> : null}
        <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{total}</Text>
        {detalle ? <Text style={[typeScale.secundario, { color: c.text }]}>{detalle}</Text> : null}
      </View>
    </>
  )
  const estilo = {
    flexDirection: 'row' as const, gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4], minHeight: 44,
    borderTopWidth: separada ? 1 : 0, borderTopColor: c.border,
  }
  if (!onAbrir) return <View accessible accessibilityLabel={etiqueta} style={estilo}>{contenido}</View>
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} onPress={() => onAbrir(v)} android_ripple={{ color: c.surface2 }} style={estilo}>
      {contenido}
    </Pressable>
  )
}

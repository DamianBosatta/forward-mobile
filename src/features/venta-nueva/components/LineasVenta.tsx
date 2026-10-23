import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { radii, space, typeScale, importe, useColors } from '@/libs/theme'
import { Notice, StatusChip, TotalsRow, formatImporte } from '@/core/ui/fw'
import { precioServidor, subtotalLinea, type LineaCarrito } from '../lib/carrito'
import { avisoTope, mostrarNumero } from '../lib/linea'
import { totalesEstimados } from '../lib/avisos'
import { agruparLineas, nombreFragancia } from '../lib/fragancias'
import { Redondo } from './ProductoCatalogoCard'

interface Props {
  lineas: LineaCarrito[]
  porAutorizar: string[]
  rechazos: string[]
  /** Descuento general vigente (%); se cambia en la hoja "Descuento a toda la venta" (R6). */
  descuentoGeneral: number | null
  onDescuentoGeneral: () => void
  onSumar: (productoId: string) => void
  onRestar: (productoId: string) => void
  tope: number
  flete?: number
  onAgregar: () => void
  onEditar: (linea: LineaCarrito) => void
  /** Abre "Elegir fragancias" de una línea padre. */
  onElegirFragancias: (padreId: string) => void
  /** Nombre de la línea padre (del catálogo de venta). */
  nombrePadre: (padreId: string) => string | undefined
  /** Aclaración bajo los avisos (p. ej., qué guarda el borrador y qué se guarda al confirmar). */
  nota?: string | null
  /** Stock en vivo: productoId → aviso de lo que cambió en una línea (avisa y deja seguir). */
  avisosStock?: Record<string, string>
  /** Stock en vivo: hay conexión. Sin este dato no se muestra el indicador. */
  enVivo?: boolean
}

/** Pestaña Líneas (lámina Venta): las líneas, el banner de autorización y los totales estimados. */
export function LineasVenta({ lineas, porAutorizar, rechazos, descuentoGeneral, onDescuentoGeneral, onSumar, onRestar, tope, flete = 0, onAgregar, onEditar, onElegirFragancias, nombrePadre, nota, avisosStock, enVivo }: Props) {
  const c = useColors()
  const t = totalesEstimados(lineas, descuentoGeneral ?? 0, flete)
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
      {enVivo === undefined ? null : <StatusChip estado={enVivo ? 'entregado' : 'pendiente'} label={enVivo ? 'Stock en vivo' : 'Sin conexión'} />}
      {Object.entries(avisosStock ?? {}).map(([id, texto]) => <Notice key={id} tone="advertencia" testID={`aviso-stock-${id}`}>{texto}</Notice>)}
      {agruparLineas(lineas).map((g) => {
        if (g.tipo === 'producto') return <LineaProducto key={g.linea.productoId} linea={g.linea} marcada={!!avisosStock?.[g.linea.productoId]} tope={tope} onEditar={onEditar} onSumar={onSumar} onRestar={onRestar} />
        const padre = nombrePadre(g.padreId) ?? g.lineas[0].producto.nombre.split(' - ')[0]
        const unidades = g.lineas.reduce((a, l) => a + l.cantidad, 0)
        return (
          <View key={g.padreId} testID={`fragancias-${g.padreId}`} style={{ padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[1] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{`${padre} · fragancias`}</Text>
              <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(g.lineas.reduce((a, l) => a + subtotalLinea(l), 0))}</Text>
            </View>
            <Text style={{ ...secundario, ...importe }}>{`${unidades} unidades`}</Text>
            {g.lineas.map((l) => (
              <Pressable key={l.productoId} accessibilityRole="button" accessibilityHint="Editar la línea" onPress={() => onEditar(l)}
                style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
                <Text style={{ ...typeScale.cuerpo, color: c.text, flex: 1 }}>{`${nombreFragancia(l.producto, padre)} ${l.cantidad}`}</Text>
                {l.descuentoPct > 0 ? <Text style={secundario}>{`Desc. ${mostrarNumero(l.descuentoPct)} %`}</Text> : null}
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel={`Elegir fragancias de ${padre}`} onPress={() => onElegirFragancias(g.padreId)}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Elegir fragancias</Text>
            </Pressable>
          </View>
        )
      })}
      <Pressable
        accessibilityRole="button"
        onPress={onAgregar}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' }}
      >
        <Plus size={20} color={c.brandInk} />
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Agregar productos</Text>
      </Pressable>
      {rechazos.map((r) => <Notice key={r} tone="peligro">{r}</Notice>)}
      {porAutorizar.length > 0 ? (
        <Notice tone="advertencia" title="Este pedido va a quedar por autorizar">
          {`Porque ${porAutorizar.join(', ')}. El sistema lo confirma al guardar.`}
        </Notice>
      ) : null}
      {nota ? <Text style={secundario}>{nota}</Text> : null}
      <View style={{ gap: space[2], paddingTop: space[2] }}>
        <TotalsRow label="Subtotal" importe={t.subtotal} />
        <Pressable accessibilityRole="button" accessibilityLabel="Descuento a toda la venta" accessibilityHint="Cambiar el descuento general" onPress={onDescuentoGeneral}
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingHorizontal: space[3], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Descuento a toda la venta</Text>
          <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.brandInk }}>{`${mostrarNumero(descuentoGeneral ?? 0)} %`}</Text>
        </Pressable>
        <TotalsRow label="Descuento general" importe={-t.descuento} />
        {flete > 0 ? <TotalsRow label="Flete (logística propia)" importe={t.flete} /> : null}
        <Text style={secundario}>Los totales son estimados: el total final lo calcula el sistema al guardar.</Text>
      </View>
    </ScrollView>
  )
}

function LineaProducto({ linea: l, marcada, tope, onEditar, onSumar, onRestar }: {
  linea: LineaCarrito; marcada: boolean; tope: number; onEditar: (l: LineaCarrito) => void; onSumar: (id: string) => void; onRestar: (id: string) => void
}) {
  const c = useColors()
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const nombre = l.producto.nombre
  return (
    <View testID={marcada ? `linea-stock-${l.productoId}` : undefined}
      style={{ minHeight: 56, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[2], ...(marcada ? { borderWidth: 2, borderColor: c.chip.porAutorizar.text } : null) }}>
      <Pressable accessibilityRole="button" accessibilityHint="Editar la línea" onPress={() => onEditar(l)} style={{ gap: space[1] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{nombre}</Text>
          <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(subtotalLinea(l))}</Text>
        </View>
        <Text style={{ ...secundario, ...importe }}>{`${l.cantidad} × ${formatImporte(precioServidor(l.producto))}`}</Text>
        {l.descuentoPct > 0 ? (
          <Text style={secundario}>
            {`Desc. ${mostrarNumero(l.descuentoPct)} %${avisoTope(l.descuentoPct, tope, false) === 'porAutorizar' ? ' · sobre tu tope' : ''}`}
          </Text>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space[1] }}>
        <Redondo c={c} label="−" a11y={`Restar ${nombre}`} onPress={() => onRestar(l.productoId)} />
        <Text accessibilityLabel={`Cantidad: ${l.cantidad}`} style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text, minWidth: 40, textAlign: 'center' }}>{l.cantidad}</Text>
        <Redondo c={c} label="+" a11y={`Sumar ${nombre}`} onPress={() => onSumar(l.productoId)} />
      </View>
    </View>
  )
}

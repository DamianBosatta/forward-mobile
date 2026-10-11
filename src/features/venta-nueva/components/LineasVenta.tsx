import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { radii, space, typeScale, importe, useColors } from '@/libs/theme'
import { Field, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import { precioServidor, subtotalLinea, type LineaCarrito } from '../lib/carrito'
import { avisoTope, mostrarNumero } from '../lib/linea'
import { totalesEstimados } from '../lib/avisos'
import { agruparLineas, nombreFragancia } from '../lib/fragancias'

interface Props {
  lineas: LineaCarrito[]
  porAutorizar: string[]
  rechazos: string[]
  /** Texto tal como lo tipea el vendedor; `descuentoGeneral` es el número ya leído. */
  descuentoTexto: string
  descuentoGeneral: number | null
  onDescuento: (texto: string) => void
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
}

/** Pestaña Líneas (lámina Venta): las líneas, el banner de autorización y los totales estimados. */
export function LineasVenta({ lineas, porAutorizar, rechazos, descuentoTexto, descuentoGeneral, onDescuento, tope, flete = 0, onAgregar, onEditar, onElegirFragancias, nombrePadre, nota }: Props) {
  const c = useColors()
  const t = totalesEstimados(lineas, descuentoGeneral ?? 0, flete)
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
      {agruparLineas(lineas).map((g) => {
        if (g.tipo === 'producto') return <LineaProducto key={g.linea.productoId} linea={g.linea} tope={tope} onEditar={onEditar} />
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
        <Field label="Descuento general (%)" keyboardType="decimal-pad" alignRight value={descuentoTexto} onChangeText={onDescuento}
          error={descuentoGeneral === null ? 'Ingresá un descuento entre 0 y 100.' : undefined} />
        <TotalsRow label="Descuento general" importe={-t.descuento} />
        {flete > 0 ? <TotalsRow label="Flete (logística propia)" importe={t.flete} /> : null}
        <Text style={secundario}>Los totales son estimados: el total final lo calcula el sistema al guardar.</Text>
      </View>
    </ScrollView>
  )
}

function LineaProducto({ linea: l, tope, onEditar }: { linea: LineaCarrito; tope: number; onEditar: (l: LineaCarrito) => void }) {
  const c = useColors()
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Editar la línea"
      onPress={() => onEditar(l)}
      style={{ minHeight: 56, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[1] }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{l.producto.nombre}</Text>
        <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(subtotalLinea(l))}</Text>
      </View>
      <Text style={{ ...secundario, ...importe }}>{`${l.cantidad} × ${formatImporte(precioServidor(l.producto))}`}</Text>
      {l.descuentoPct > 0 ? (
        <Text style={secundario}>
          {`Desc. ${mostrarNumero(l.descuentoPct)} %${avisoTope(l.descuentoPct, tope, false) === 'porAutorizar' ? ' · sobre tu tope' : ''}`}
        </Text>
      ) : null}
    </Pressable>
  )
}

import React, { useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { importe, maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, formatImporte } from '@/core/ui/fw'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { useVariantesProducto } from '@/libs/api-client/productos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { multiploDe, precioServidor, subtotalLinea } from '../lib/carrito'
import { descuentoDeFragancias, errorDeCantidadFragancia, nombreFragancia, stockDeFragancia } from '../lib/fragancias'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoTope, leerNumero, mostrarNumero } from '../lib/linea'
import { limitarDigitos } from '../lib/teclado'
import { RENGLONES_PARA_BUSCAR, normalizarBusqueda } from '@/core/utils/texto'

interface Props {
  /** Línea padre a repartir; null = cerrada. */
  padreId: string | null
  onClose: () => void
  /** Lo que el cliente llevó en su último pedido (producto → cantidad): habilita "Como la última vez". */
  llevo?: Map<string, number> | null
}

/**
 * "Elegir fragancias" (plan 9 §2.1, PR 2.4): reparte una línea padre en sus variantes, de a la
 * venta mínima de cada una. Las variantes salen del catálogo de venta (traen precio, piso y venta
 * mínima); la disponibilidad, de GET /Productos/{id}/variantes en el depósito de la venta. Como en
 * la web (DistribucionFraganciasModal): no se pide más que el stock disponible de cada fragancia y
 * el descuento es UNO para toda la línea.
 */
export function FraganciasSheet({ padreId, onClose, llevo = null }: Props) {
  if (!padreId) return null
  return <Contenido key={padreId} padreId={padreId} onClose={onClose} llevo={llevo} />
}

function Contenido({ padreId, onClose, llevo }: { padreId: string; onClose: () => void; llevo: Map<string, number> | null }) {
  const c = useColors()
  const { productos, isLoading } = useCatalogoVenta('')
  const { lineas, repartirFragancias } = useCarritoVenta()
  const user = useAuthStore((s) => s.user)
  const verCantidades = hasCapability(user?.permissions, 'CAP_VER_CANTIDADES_STOCK')
  const servidor = useVariantesProducto(padreId, true, DEPOSITO_CENTRAL_ID)
  const padre = productos.find((p) => p.id === padreId)
  const variantes = useMemo(() => productos.filter((p) => p.productoPadreId === padreId), [productos, padreId])
  // Lo que el vendedor tipea en cada fragancia (vacío = 0). La cantidad sale de acá; nunca se baja sola.
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(lineas.filter((l) => l.producto.productoPadreId === padreId).map((l) => [l.productoId, mostrarNumero(l.cantidad)])))
  const cantidades = useMemo(() => Object.fromEntries(Object.entries(textos).map(([id, t]) => [id, t === '' ? 0 : Number(t)])) as Record<string, number>, [textos])
  const disponibleDe = (v: (typeof variantes)[number]) => stockDeFragancia(v, servidor.data?.find((s) => s.id === v.id), verCantidades)
  // S9: la regla vive en errorDeCantidadFragancia; nunca se baja lo que escribio el vendedor.
  const errorDeCantidad = (v: (typeof variantes)[number]) => errorDeCantidadFragancia(cantidades[v.id] ?? 0, multiploDe(v), disponibleDe(v), verCantidades)
  const hayErrorDeCantidad = variantes.some((v) => errorDeCantidad(v) !== undefined)
  const [pctTexto, setPctTexto] = useState(() => mostrarNumero(descuentoDeFragancias(lineas, padreId)))
  const pctLeido = leerNumero(pctTexto)
  const pctInvalido = pctLeido === null || pctLeido < 0 || pctLeido > 100
  const tope = avisoTope(pctInvalido ? 0 : pctLeido, user?.maxDescuentoPorcentaje ?? 0, hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO'))
  const scrollRef = useRef<ScrollView>(null)
  const campos = useRef<Record<string, TextInput | null>>({})
  const filas = useRef<Record<string, number>>({})
  // Desde 8 fragancias se busca por nombre, sin tildes ni mayúsculas (mismo umbral que la consola del chofer).
  // Lo tipeado en las filas ocultas se conserva en `textos`, así que sigue sumando a las unidades y al total.
  const [busqueda, setBusqueda] = useState('')
  const conBuscador = variantes.length >= RENGLONES_PARA_BUSCAR
  const nombreDe = (v: (typeof variantes)[number]) => servidor.data?.find((x) => x.id === v.id)?.fraganciaNombre ?? nombreFragancia(v, padre?.nombre)
  const buscado = normalizarBusqueda(busqueda.trim())
  const visibles = conBuscador && buscado ? variantes.filter((v) => normalizarBusqueda(nombreDe(v)).includes(buscado)) : variantes
  const total = Object.values(cantidades).reduce((a, n) => a + n, 0)
  const escribir = (id: string, texto: string) => setTextos((s) => ({ ...s, [id]: limitarDigitos(texto.replace(/\D/g, '')) }))
  // "Como la última vez": lo que llevó de cada fragancia, acotado al stock (en múltiplos) al llenar los campos: el
  // vendedor ve el valor acotado en el campo antes de confirmar, no cambia al confirmar.
  const delUltimo = Object.fromEntries(variantes.flatMap((v) => {
    const llevado = llevo?.get(v.id)
    if (!llevado) return []
    const m = multiploDe(v)
    const n = Math.min(llevado, Math.floor(disponibleDe(v) / m) * m)
    return n > 0 ? [[v.id, n]] : []
  }))
  const hayUltimo = Object.keys(delUltimo).length > 0
  const subtotal = variantes.reduce((a, v) => a + subtotalLinea({ productoId: v.id, producto: v, cantidad: cantidades[v.id] ?? 0, descuentoPct: pctInvalido ? 0 : pctLeido }), 0)

  return (
    <BottomSheet visible onClose={onClose} accessibilityLabel="Elegir fragancias">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[2] }}>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{padre?.nombre ?? 'Fragancias'}</Text>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {padre ? `${formatImporte(precioServidor(padre))} c/u · ${variantes.length} fragancias` : 'Elegí cuántas de cada fragancia.'}
          </Text>
        </View>
        {hayUltimo ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Como la última vez" onPress={() => setTextos(Object.fromEntries(Object.entries(delUltimo).map(([id, n]) => [id, mostrarNumero(n)])))} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Como la última vez</Text>
          </Pressable>
        ) : null}
      </View>
      {isLoading ? <ActivityIndicator color={c.brand} /> : null}
      {!isLoading && variantes.length === 0 ? (
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Esta línea no tiene fragancias a la venta.</Text>
      ) : null}
      {conBuscador ? <Field label="Buscar fragancia" value={busqueda} onChangeText={setBusqueda} autoCorrect={false} /> : null}
      {conBuscador && buscado && visibles.length === 0 ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Ninguna fragancia coincide con la búsqueda.</Text> : null}
      <ScrollView ref={scrollRef} style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
        {visibles.map((v, i) => {
          const delServidor = servidor.data?.find((s) => s.id === v.id)
          const disponible = stockDeFragancia(v, delServidor, verCantidades)
          const nombre = delServidor?.fraganciaNombre ?? nombreFragancia(v, padre?.nombre)
          const m = multiploDe(v)
          const error = errorDeCantidad(v)
          const stock = disponible <= 0 ? 'Sin stock' : verCantidades ? `Stock: ${disponible}` : 'Hay stock'
          // El precio va una sola vez en el encabezado; en la fila, solo si esta fragancia cuesta distinto.
          const distinto = !padre || precioServidor(v) !== precioServidor(padre)
          const detalle = [stock, m > 1 ? `de a ${m}` : null, distinto ? formatImporte(precioServidor(v)) : null].filter(Boolean).join(' · ')
          const ultima = i === visibles.length - 1
          return (
            <View key={v.id} testID={`fragancia-${v.id}`} onLayout={(e) => { filas.current[v.id] = e.nativeEvent.layout.y }}
              style={{ gap: space[1], paddingVertical: space[2], borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>{nombre}</Text>
                <CampoCantidad nombre={nombre} value={textos[v.id] ?? ''} onChangeText={(t) => escribir(v.id, t)} error={error}
                  inputRef={(r) => { campos.current[v.id] = r }}
                  returnKeyType={ultima ? 'done' : 'next'}
                  onSubmitEditing={() => { if (!ultima) campos.current[visibles[i + 1].id]?.focus() }}
                  onFocus={() => scrollRef.current?.scrollTo({ y: Math.max(0, (filas.current[v.id] ?? 0) - space[2]), animated: true })} />
              </View>
              <Text style={{ ...typeScale.secundario, ...importe, color: disponible <= 0 ? c.chip.anulado.text : c.textSecondary }}>{detalle}</Text>
              {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>{error}</Text> : null}
            </View>
          )
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }}>Descuento (%)</Text>
        <CampoCantidad nombre="Descuento (%)" value={pctTexto} onChangeText={setPctTexto} keyboardType="decimal-pad"
          error={pctInvalido ? 'Ingresá un descuento entre 0 y 100.' : undefined} />
      </View>
      {pctInvalido ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>Ingresá un descuento entre 0 y 100.</Text> : null}
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Se aplica a todas las fragancias de la línea.</Text>
      {tope === 'porAutorizar' ? (
        <Notice tone="advertencia" title={`Tu tope de descuento es ${user?.maxDescuentoPorcentaje} %.`}>Podés guardar el pedido, pero va a quedar por autorizar.</Notice>
      ) : null}
      {tope === 'sinConfigurar' ? <Notice tone="peligro">{MENSAJE_TOPE_SIN_CONFIGURAR}</Notice> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${total} ${total === 1 ? 'unidad' : 'unidades'}`}</Text>
        <Text testID="fragancias-subtotal" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(subtotal)}</Text>
      </View>
      <Button
        label={total > 0 ? 'Agregar a la venta' : 'Listo'}
        disabled={variantes.length === 0 || pctInvalido || hayErrorDeCantidad}
        onPress={() => { repartirFragancias(padreId, variantes, Object.fromEntries(variantes.map((v) => [v.id, cantidades[v.id] ?? 0])), pctLeido ?? 0); onClose() }}
      />
    </BottomSheet>
  )
}

/**
 * Campo numérico compacto: el nombre ya está en la fila, así que no lleva etiqueta visible (Field la
 * dibuja siempre). Mismo alto, radio, relleno y borde que Field.
 */
function CampoCantidad({ nombre, value, onChangeText, error, keyboardType = 'number-pad', inputRef, onFocus, ...resto }: {
  nombre: string; value: string; onChangeText: (t: string) => void; error?: string
  keyboardType?: 'number-pad' | 'decimal-pad'; inputRef?: (r: TextInput | null) => void
} & Pick<TextInputProps, 'returnKeyType' | 'onSubmitEditing' | 'onFocus'>) {
  const c = useColors()
  const [foco, setFoco] = useState(false)
  const conMarca = foco || !!error
  return (
    <TextInput
      {...resto}
      ref={inputRef}
      accessibilityLabel={nombre}
      accessibilityHint={error}
      keyboardType={keyboardType}
      selectTextOnFocus
      submitBehavior={resto.returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
      placeholderTextColor={c.textSecondary}
      maxFontSizeMultiplier={maxFontScale}
      value={value}
      onChangeText={onChangeText}
      onFocus={(e) => { setFoco(true); onFocus?.(e) }}
      onBlur={() => setFoco(false)}
      style={{
        ...typeScale.cuerpo,
        width: 96,
        height: space[12],
        borderRadius: radii.campo,
        borderWidth: conMarca ? 2 : 1,
        borderColor: error ? c.chip.anulado.text : foco ? c.brand : c.border,
        backgroundColor: conMarca ? c.surface : c.surface2,
        paddingHorizontal: space[3] - (conMarca ? 1 : 0),
        paddingVertical: 0,
        color: c.text,
        textAlign: 'right',
      }}
    />
  )
}

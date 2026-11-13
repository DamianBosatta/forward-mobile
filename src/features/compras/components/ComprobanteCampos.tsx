import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Field } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { ALICUOTAS, type FormComprobante, type Letra } from '../lib/comprobante'

const LETRAS: Letra[] = ['A', 'B', 'C']

/** Grupo de opciones de una sola elección, con el mismo aspecto que los filtros de la lista. */
function Opciones<T extends string>({ etiqueta, opciones, valor, onCambio }: {
  etiqueta: string; opciones: { value: T; label: string }[]; valor: T; onCambio: (v: T) => void
}) {
  const c = useColors()
  return (
    <View style={{ gap: space[1] }}>
      <Text style={[typeScale.secundario, { color: c.text }]}>{etiqueta}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={etiqueta} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {opciones.map((o) => {
          const sel = o.value === valor
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ selected: sel }} onPress={() => onCambio(o.value)}
              style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}>
              <Text style={[typeScale.secundario, { color: sel ? c.brandInk : c.text }]}>{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/**
 * Los datos del comprobante del proveedor como figuran en el papel (factura A, B o C con una
 * alícuota). Percepciones, no gravado, exento y varias alícuotas se cargan en la web.
 */
export function ComprobanteCampos({ form, onCambio }: { form: FormComprobante; onCambio: (f: FormComprobante) => void }) {
  const c = useColors()
  const set = (cambio: Partial<FormComprobante>) => onCambio({ ...form, ...cambio })
  const tarjeta = { gap: space[3], padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface } as const
  const titulo = (t: string) => <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{t}</Text>
  // Los campos de una fila se alinean arriba: si uno lleva ayuda o error, el de al lado no se estira.
  const fila = { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] } as const
  return (
    <View style={{ gap: space[3] }}>
      <View style={tarjeta}>
        {titulo('Comprobante')}
        <Opciones etiqueta="Letra" opciones={LETRAS.map((l) => ({ value: l, label: l }))} valor={form.letra} onCambio={(letra) => set({ letra })} />
        <View style={fila}>
          <View style={{ flex: 1 }}><Field label="Punto de venta" value={form.puntoVenta} onChangeText={(puntoVenta) => set({ puntoVenta })} keyboardType="number-pad" /></View>
          <View style={{ flex: 2 }}><Field label="Número" value={form.numero} onChangeText={(numero) => set({ numero })} keyboardType="number-pad" /></View>
        </View>
        <Field label="Fecha del comprobante" placeholder="dd/mm/aaaa" value={form.fecha} onChangeText={(fecha) => set({ fecha })} keyboardType="numbers-and-punctuation" />
      </View>
      <View style={tarjeta}>
        {titulo('Proveedor')}
        <Field label="CUIT del proveedor" value={form.cuit} onChangeText={(cuit) => set({ cuit })} keyboardType="numbers-and-punctuation" />
        <Field label="Razón social" value={form.razonSocial} onChangeText={(razonSocial) => set({ razonSocial })} />
      </View>
      <View style={tarjeta}>
        {titulo('Importes')}
        {form.letra === 'A' ? (
          <>
            <Opciones etiqueta="Alícuota de IVA" opciones={ALICUOTAS} valor={form.alicuota} onCambio={(alicuota) => set({ alicuota })} />
            <View style={fila}>
              <View style={{ flex: 1 }}><Field label="Neto gravado" value={form.neto} onChangeText={(neto) => set({ neto })} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="IVA" value={form.iva} onChangeText={(iva) => set({ iva })} keyboardType="decimal-pad" help="Vacío: se calcula del neto." /></View>
            </View>
          </>
        ) : null}
        <Field label="Total" value={form.total} onChangeText={(total) => set({ total })} keyboardType="decimal-pad" />
      </View>
    </View>
  )
}

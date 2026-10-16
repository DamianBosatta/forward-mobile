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
  const set = (cambio: Partial<FormComprobante>) => onCambio({ ...form, ...cambio })
  return (
    <View style={{ gap: space[3] }}>
      <Opciones etiqueta="Letra" opciones={LETRAS.map((l) => ({ value: l, label: l }))} valor={form.letra} onCambio={(letra) => set({ letra })} />
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}><Field label="Punto de venta" value={form.puntoVenta} onChangeText={(puntoVenta) => set({ puntoVenta })} keyboardType="number-pad" /></View>
        <View style={{ flex: 2 }}><Field label="Número" value={form.numero} onChangeText={(numero) => set({ numero })} keyboardType="number-pad" /></View>
      </View>
      <Field label="Fecha del comprobante" placeholder="dd/mm/aaaa" value={form.fecha} onChangeText={(fecha) => set({ fecha })} keyboardType="numbers-and-punctuation" />
      <Field label="CUIT del proveedor" value={form.cuit} onChangeText={(cuit) => set({ cuit })} keyboardType="numbers-and-punctuation" />
      <Field label="Razón social" value={form.razonSocial} onChangeText={(razonSocial) => set({ razonSocial })} />
      {form.letra === 'A' ? (
        <>
          <Opciones etiqueta="Alícuota de IVA" opciones={ALICUOTAS} valor={form.alicuota} onCambio={(alicuota) => set({ alicuota })} />
          <Field label="Neto gravado" value={form.neto} onChangeText={(neto) => set({ neto })} keyboardType="decimal-pad" />
          <Field label="IVA" value={form.iva} onChangeText={(iva) => set({ iva })} keyboardType="decimal-pad" help="Vacío: se calcula del neto." />
        </>
      ) : null}
      <Field label="Total" value={form.total} onChangeText={(total) => set({ total })} keyboardType="decimal-pad" />
    </View>
  )
}

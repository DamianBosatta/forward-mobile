import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Trash2 } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import {
  ORDEN_DIAS, expandirFilas, letraDelDia, nombreDelDia, textoHorario, validarFilas, horaValida, type FilaHorario,
} from '@/core/utils/horario'

export const FILA_NUEVA: FilaHorario = { dias: [], desde: '08:00', hasta: '12:00' }
const PRESETS = [
  { label: 'L a V', dias: [1, 2, 3, 4, 5] },
  { label: 'L a S', dias: [1, 2, 3, 4, 5, 6] },
]
const mismosDias = (a: number[], b: number[]) => a.length === b.length && a.every(d => b.includes(d))

/** Chip de un día: la letra se ve (L M X J V S D) y el lector de pantalla dice el nombre completo. */
function DiaChip({ dia, activo, onPress }: { dia: number; activo: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={nombreDelDia(dia)}
      accessibilityState={{ selected: activo }}
      android_ripple={{ color: c.surface2 }}
      style={{
        width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pastilla,
        borderWidth: activo ? 2 : 1, borderColor: activo ? c.brand : c.borderStrong, backgroundColor: activo ? c.brandSoft : c.surface,
      }}
    >
      <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.secundario, color: activo ? c.brandInk : c.text }}>{letraDelDia(dia)}</Text>
    </Pressable>
  )
}

interface Props {
  filas: FilaHorario[]
  onChange: (filas: FilaHorario[]) => void
  /** Se muestran los errores de cada fila recién después de intentar guardar o de tocar la fila. */
  mostrarErrores?: boolean
}

/**
 * "Horario de entrega": una fila por rango (días + desde/hasta) en vez de una por día. Al guardar, el formulario
 * abre las filas en una franja por día (`expandirFilas`). Debajo, el texto corto que va en la nota de entrega.
 */
export function HorarioEntregaEditor({ filas, onChange, mostrarErrores = true }: Props) {
  const c = useColors()
  const errores = validarFilas(filas)
  const validas = filas.filter((_, i) => !errores[i]).map(f => ({ ...f, desde: horaValida(f.desde)!, hasta: horaValida(f.hasta)! }))
  const resumen = textoHorario(expandirFilas(validas))
  const cambiarFila = (i: number, parcial: Partial<FilaHorario>) => onChange(filas.map((f, j) => (j === i ? { ...f, ...parcial } : f)))
  const alternar = (i: number, dia: number) => {
    const f = filas[i]
    cambiarFila(i, { dias: f.dias.includes(dia) ? f.dias.filter(d => d !== dia) : [...f.dias, dia] })
  }

  return (
    <View testID="horario-entrega" style={{ gap: space[4] }}>
      {filas.length === 0 ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Sin horario cargado: se entrega cuando llegue el chofer.</Text>
      ) : null}
      {filas.map((fila, i) => (
        <View key={i} testID={`horario-fila-${i}`} style={{ gap: space[3], borderWidth: 1, borderColor: errores[i] && mostrarErrores ? c.chip.anulado.text : c.border, borderRadius: radii.campo, padding: space[3] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {PRESETS.map(p => (
              <FiltroChip key={p.label} label={p.label} activo={mismosDias(fila.dias, p.dias)} onPress={() => cambiarFila(i, { dias: p.dias })} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {ORDEN_DIAS.map(d => <DiaChip key={d} dia={d} activo={fila.dias.includes(d)} onPress={() => alternar(i, d)} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Field label="Desde" value={fila.desde} onChangeText={v => cambiarFila(i, { desde: v })} keyboardType="numbers-and-punctuation" placeholder="08:00" invalid={mostrarErrores && !!errores[i]} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Hasta" value={fila.hasta} onChangeText={v => cambiarFila(i, { hasta: v })} keyboardType="numbers-and-punctuation" placeholder="12:00" invalid={mostrarErrores && !!errores[i]} />
            </View>
          </View>
          {mostrarErrores && errores[i] ? <Text accessibilityRole="alert" style={{ ...typeScale.secundario, color: c.chip.anulado.text }}>{errores[i]}</Text> : null}
          <Pressable
            onPress={() => onChange(filas.filter((_, j) => j !== i))}
            accessibilityRole="button"
            accessibilityLabel="Quitar horario"
            android_ripple={{ color: c.surface2 }}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'flex-start' }}
          >
            <Trash2 size={18} color={c.textSecondary} />
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Quitar horario</Text>
          </Pressable>
        </View>
      ))}
      <Button label="Agregar horario" variant="secundario" onPress={() => onChange([...filas, { ...FILA_NUEVA, dias: [...FILA_NUEVA.dias] }])} />
      {resumen ? (
        <Text testID="horario-resumen" accessibilityLabel={`Se va a leer así en la nota de entrega: ${resumen}`} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>
          {resumen}
        </Text>
      ) : null}
    </View>
  )
}

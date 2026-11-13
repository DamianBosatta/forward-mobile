import React from 'react'
import { Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Casilla, FiltroChip, Notice } from '@/core/ui/fw'
import { CampoDeSocio } from '@/features/socios/components/CampoDeSocio'
import { FilaBloqueada } from '@/features/socios/components/FilaBloqueada'
import { TIPOS_PAGO, textoCondicionPago } from '../lib/cliente'
import {
  AVISO_CONDICIONES_SOLO_LECTURA, AVISO_NO_COBRAR, AVISO_UNA_PREDETERMINADA, agregarFila, cambiarFila, marcarPredeterminada, quitarFila,
  type ErrorFilaCondicion, type FilaCondicion,
} from '../lib/condicionesPago'

interface Props {
  filas: FilaCondicion[]
  onChange: (filas: FilaCondicion[]) => void
  /** Sin permiso para cambiarlas (`puedeEditarCondicionesPago`): se muestran, no se editan. */
  soloLectura: boolean
  errores?: ErrorFilaCondicion[]
}

const etiquetaPlazo = (tipo: FilaCondicion['tipo']) => (tipo === 'DiaFijoDelMes' ? 'Día del mes' : 'Días')

/**
 * Condiciones de pago habilitadas del cliente: varias, exactamente una predeterminada. Cada venta
 * elige una de estas (o Contado, que siempre se puede). Con `soloLectura` no hay controles.
 */
export function CondicionesPagoClienteEditor({ filas, onChange, soloLectura, errores = [] }: Props) {
  const c = useColors()
  if (soloLectura) {
    return (
      <View style={{ gap: space[2] }}>
        {filas.length === 0 ? (
          <FilaBloqueada etiqueta="Condición de pago" valor="Contado" razon={AVISO_CONDICIONES_SOLO_LECTURA} />
        ) : filas.map((f, i) => (
          <FilaBloqueada
            key={i}
            etiqueta={f.predeterminada ? 'Condición de pago (predeterminada)' : 'Condición de pago'}
            valor={textoCondicionPago({ tipo: f.tipo || 'Contado', dias: Number(f.plazo) || null, diaDelMes: Number(f.plazo) || null })}
            razon={AVISO_CONDICIONES_SOLO_LECTURA}
          />
        ))}
      </View>
    )
  }
  return (
    <View style={{ gap: space[3] }}>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{AVISO_UNA_PREDETERMINADA}</Text>
      {filas.map((f, i) => {
        const e = errores[i] ?? {}
        return (
          <View key={i} testID={`condicion-${i}`} style={{ gap: space[2], padding: space[3], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: e.tipo || e.plazo ? c.danger : c.border }}>
            <View accessibilityRole="radiogroup" accessibilityLabel={`Condición ${i + 1}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {TIPOS_PAGO.map((t) => (
                <FiltroChip
                  key={t.value}
                  rol="radio"
                  label={t.label}
                  accessibilityLabel={`${t.label}, condición ${i + 1}`}
                  activo={f.tipo === t.value}
                  onPress={() => onChange(cambiarFila(filas, i, { tipo: t.value, plazo: t.value === 'Contado' ? '' : f.plazo }))}
                />
              ))}
            </View>
            {f.tipo !== '' && f.tipo !== 'Contado' ? (
              <CampoDeSocio
                label={filas.length > 1 ? `${etiquetaPlazo(f.tipo)} (condición ${i + 1})` : etiquetaPlazo(f.tipo)}
                value={f.plazo}
                onChangeText={(v) => onChange(cambiarFila(filas, i, { plazo: v.replace(/\D/g, '') }))}
                keyboardType="number-pad"
                error={e.plazo}
              />
            ) : null}
            {e.tipo ? <Text accessibilityRole="alert" style={{ ...typeScale.secundario, color: c.danger }}>{e.tipo}</Text> : null}
            <Casilla
              label="Predeterminada"
              accessibilityLabel={`Predeterminada, condición ${i + 1}`}
              marcada={f.predeterminada}
              onPress={() => onChange(marcarPredeterminada(filas, i))}
            />
            {filas.length > 1 ? (
              <Button label="Quitar" accessibilityLabel={`Quitar condición ${i + 1}`} variant="peligroContorno" onPress={() => onChange(quitarFila(filas, i))} />
            ) : null}
          </View>
        )
        })}
      <Button label="Agregar condición" icon={Plus} variant="secundario" onPress={() => onChange(agregarFila(filas))} />
      <Notice tone="info">{AVISO_NO_COBRAR}</Notice>
    </View>
  )
}

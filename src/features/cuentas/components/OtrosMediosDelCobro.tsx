import React from 'react'
import { View } from 'react-native'
import { space, useColors } from '@/libs/theme'
import { Button, Field } from '@/core/ui/fw'
import type { MedioDePago } from '../api/cobros'
import type { OtroMedio } from '../lib/cobro'
import { ElegirChip } from './ElegirChip'

interface Props {
  medios: MedioDePago[]
  valor: OtroMedio[]
  onCambio: (otros: OtroMedio[]) => void
  disabled?: boolean
}

const vacio = (): OtroMedio => ({ medioPagoId: null, monto: '', esCheque: false, requiereCaja: false })

/**
 * Cobro combinado (lámina ResCobro, "¿Cómo te pagó? Podés combinar"): los medios que se suman al primero,
 * cada uno con su monto. El primer medio es el de siempre ("Medio" y "Monto"); estos son el 2, el 3...
 * Solo medio y monto: la cuenta de cada línea la pone el servidor según el medio.
 */
export function OtrosMediosDelCobro({ medios, valor, onCambio, disabled }: Props) {
  const c = useColors()
  const cambiar = (i: number, cambio: Partial<OtroMedio>) => onCambio(valor.map((o, j) => (j === i ? { ...o, ...cambio } : o)))
  const opciones = medios.filter(m => m.activo && m.id).map(m => ({ id: m.id!, label: m.nombre ?? '' }))

  return (
    <>
      {valor.map((o, i) => {
        const n = i + 2
        return (
          <View key={i} style={{ gap: space[2], paddingTop: space[3], borderTopWidth: 1, borderTopColor: c.border }}>
            <ElegirChip
              titulo={`Medio ${n}`}
              opciones={opciones}
              valor={o.medioPagoId}
              onCambio={id => {
                const m = medios.find(x => x.id === id)
                cambiar(i, { medioPagoId: id, esCheque: !!m?.esCheque, requiereCaja: !!m?.requiereCaja })
              }}
            />
            <Field label={`Monto del medio ${n}`} value={o.monto} onChangeText={v => cambiar(i, { monto: v })} keyboardType="decimal-pad" alignRight />
            <Button label={`Quitar el medio ${n}`} variant="secundario" disabled={disabled} onPress={() => onCambio(valor.filter((_, j) => j !== i))} />
          </View>
        )
      })}
      <Button label="Otro medio" variant="secundario" disabled={disabled} onPress={() => onCambio([...valor, vacio()])} />
    </>
  )
}

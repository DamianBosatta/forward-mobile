import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { CuentaCorrienteResumenDto } from '@/libs/api-client/types'

/** Lo que el selector necesita de una cuenta: el saldo es opcional (la lista liviana no lo trae). */
type CuentaElegible = Pick<CuentaCorrienteResumenDto, 'id' | 'nombre'> & { saldoActual?: number | null }

interface Props {
  titulo: string
  cuentas: CuentaElegible[]
  valor: string | null
  onCambio: (id: string) => void
  /** Opción extra al final (p. ej. "Ninguna: la plata sale"), con su valor. */
  extra?: { valor: string; label: string }
  /** Dentro de la tarjeta conectada Desde → Hacia: las opciones sin elegir van sin marco propio. */
  plano?: boolean
}

/** Lista de cuentas propias para elegir una, con el saldo que informa el servidor cuando lo manda (lámina Transferencia). */
export function ElegirCuenta({ titulo, cuentas, valor, onCambio, extra, plano = false }: Props) {
  const c = useColors()
  const opciones = [
    ...cuentas.map(k => ({ id: k.id, label: k.nombre, saldo: k.saldoActual == null ? '' : formatImporte(k.saldoActual) })),
    ...(extra ? [{ id: extra.valor, label: extra.label, saldo: '' }] : []),
  ]
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ gap: space[1], padding: plano ? space[2] : 0 }}>
      <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.text }}>{titulo}</Text>
      {opciones.map(o => {
        const elegida = o.id === valor
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.saldo ? `${o.label}, saldo ${o.saldo}` : o.label}
            accessibilityState={{ checked: elegida, selected: elegida }}
            onPress={() => onCambio(o.id)}
            style={{
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              paddingHorizontal: space[3],
              borderRadius: radii.campo,
              backgroundColor: elegida ? c.brandSoft : plano ? 'transparent' : c.surface,
              borderWidth: elegida ? 2 : 1,
              borderColor: elegida ? c.brand : plano ? 'transparent' : c.border,
            }}
          >
            <Text style={{ ...typeScale.cuerpo, flex: 1, color: c.text }}>{o.label}</Text>
            {o.saldo ? <Text style={[typeScale.secundario, importe, { color: c.textSecondary }]}>{o.saldo}</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

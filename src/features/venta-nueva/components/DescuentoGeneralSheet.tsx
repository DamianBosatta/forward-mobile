import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, TotalsRow } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import type { LineaCarrito } from '../lib/carrito'
import { totalesEstimados } from '../lib/avisos'
import { MENSAJE_TOPE_SIN_CONFIGURAR, avisoTope, leerNumero, mostrarNumero } from '../lib/linea'
import { opcionesDeDescuento } from './CantidadSheet'

interface Props {
  visible: boolean
  /** El descuento general vigente (%). */
  valor: number
  lineas: LineaCarrito[]
  flete: number
  onClose: () => void
  onAplicar: (pct: number) => void
}

/** R6 "Descuento a toda la venta" (ResDescuentoGeneral): chips, "Otro" y cómo queda el total. */
export function DescuentoGeneralSheet(props: Props) {
  if (!props.visible) return null
  return <Contenido {...props} />
}

function Contenido({ valor, lineas, flete, onClose, onAplicar }: Props) {
  const c = useColors()
  const user = useAuthStore((s) => s.user)
  const tope = user?.maxDescuentoPorcentaje ?? 0
  const exento = hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO')
  const opciones = opcionesDeDescuento(tope, exento)
  const [texto, setTexto] = useState(mostrarNumero(valor))
  const [otro, setOtro] = useState(() => !opciones.includes(valor))
  const leido = leerNumero(texto)
  const invalido = leido === null || leido < 0 || leido > 100
  const pct = invalido ? 0 : leido
  const t = totalesEstimados(lineas, pct, flete)
  const aviso = avisoTope(pct, tope, exento)
  const chip = (activo: boolean) => ({
    minHeight: 44, paddingHorizontal: space[4], borderRadius: radii.pastilla, justifyContent: 'center' as const,
    backgroundColor: activo ? c.action : c.surface, borderWidth: activo ? 0 : 1, borderColor: c.border,
  })

  return (
    <BottomSheet visible onClose={onClose} accessibilityLabel="Descuento a toda la venta">
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Descuento a toda la venta</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {opciones.map((o) => {
          const activo = !otro && pct === o
          return (
            <Pressable key={o} accessibilityRole="button" accessibilityLabel={`${mostrarNumero(o)} %`} accessibilityState={{ selected: activo }}
              onPress={() => { setOtro(false); setTexto(mostrarNumero(o)) }} style={chip(activo)}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.onAction : c.text }}>{`${mostrarNumero(o)} %`}</Text>
            </Pressable>
          )
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Otro porcentaje" accessibilityState={{ selected: otro }} onPress={() => setOtro(true)} style={chip(otro)}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: otro ? c.onAction : c.text }}>Otro</Text>
        </Pressable>
      </View>
      {otro ? (
        <Field label="Descuento general (%)" keyboardType="decimal-pad" alignRight value={texto} onChangeText={setTexto}
          error={invalido ? 'Ingresá un descuento entre 0 y 100.' : undefined} />
      ) : null}
      <View style={{ gap: space[2] }}>
        <TotalsRow label="Subtotal" importe={t.subtotal} />
        <TotalsRow label={`Descuento ${mostrarNumero(pct)} %`} importe={-t.descuento} />
        {flete > 0 ? <TotalsRow label="Flete" importe={t.flete} /> : null}
        <TotalsRow label="Total" importe={t.total} destacado />
      </View>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        Se suma al descuento de cada línea. Si en alguna pasa tu tope, el pedido queda por autorizar.
      </Text>
      {aviso === 'porAutorizar' ? <Notice tone="advertencia">{`Supera tu tope de ${mostrarNumero(tope)} %: el pedido queda por autorizar.`}</Notice> : null}
      {aviso === 'sinConfigurar' ? <Notice tone="peligro">{MENSAJE_TOPE_SIN_CONFIGURAR}</Notice> : null}
      <Button label="Aplicar" disabled={invalido} onPress={() => onAplicar(pct)} />
    </BottomSheet>
  )
}

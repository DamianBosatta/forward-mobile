import React, { useEffect, useState } from 'react'
import { Pressable, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors, importe } from '@/libs/theme'

interface Props {
  value: number
  max: number
  onChange: (value: number) => void
  /** Nombre de lo que se cuenta: arma "Quitar una de X" y "Sumar una de X". */
  nombre: string
  /** De a cuánto sube y baja cada flecha (la venta mínima de la fragancia). Por defecto, de a uno. */
  paso?: number
  /** `false`: lo tipeado por encima de `max` no se baja; quien lo usa avisa el error. Las flechas igual respetan `max`. */
  acotar?: boolean
  /** Botones de 44 pt para filas apretadas (la hoja de fragancias); por defecto 56 pt. */
  compacto?: boolean
  /** Nombre accesible del campo; por defecto "Cantidad de X: N". */
  etiquetaCampo?: string
  /** Texto de error ligado al campo para lectores de pantalla y marca de borde. */
  error?: string
  /** Con 0 el campo queda vacío (no dice 0): la fila de fragancias sin cantidad. Cuenta como 0 igual. */
  vacioEnCero?: boolean
  inputRef?: (r: TextInputInstance | null) => void
}

const aNumero = (t: string) => (t === '' ? 0 : Number(t))

/**
 * Contador para cargar cantidades con el pulgar (lámina chofer-03): flecha arriba suma, flecha abajo resta y el
 * número del medio se puede tipear a mano. El + va relleno; el tope es lo disponible. Es el único contador de
 * cantidades de la app (devoluciones del chofer y elección de fragancias).
 */
export function Stepper({ value, max, onChange, nombre, paso = 1, acotar = true, compacto = false, vacioEnCero = false, etiquetaCampo, error, inputRef, ...resto }: Props & Pick<TextInputProps, 'returnKeyType' | 'onSubmitEditing' | 'onFocus'>) {
  const c = useColors()
  const mostrar = (n: number) => (n === 0 && vacioEnCero ? '' : String(n))
  const [texto, setTexto] = useState(mostrar(value))
  const [foco, setFoco] = useState(false)
  // El valor manda cuando cambia desde afuera (flechas, "Como la última vez"); mientras tipea, el texto es el suyo.
  useEffect(() => {
    setTexto((t) => (aNumero(t) === value ? t : mostrar(value)))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const puedeBajar = value > 0
  const puedeSubir = value + paso <= max
  const lado = compacto ? 44 : 56
  const boton = (activo: boolean, relleno: boolean) => ({
    width: lado,
    height: lado,
    borderRadius: radii.campo,
    borderWidth: 2,
    borderColor: activo ? (relleno ? c.action : c.textSecondary) : c.border,
    backgroundColor: activo ? (relleno ? c.action : c.surface) : c.surface2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  })
  const tipear = (t: string) => {
    const limpio = t.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7)
    setTexto(limpio)
    const n = aNumero(limpio)
    onChange(acotar ? Math.min(n, Number.isFinite(max) ? max : n) : n)
  }
  const conMarca = foco || !!error
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Quitar una de ${nombre}`}
        accessibilityState={{ disabled: !puedeBajar }}
        disabled={!puedeBajar}
        android_ripple={{ color: c.border }}
        onPress={() => onChange(Math.max(0, value - paso))}
        style={boton(puedeBajar, false)}
      >
        <ChevronDown size={26} color={puedeBajar ? c.text : c.textSecondary} strokeWidth={3} />
      </Pressable>
      <TextInput
        {...resto}
        ref={inputRef}
        accessibilityLabel={etiquetaCampo ?? `Cantidad de ${nombre}: ${value}`}
        accessibilityHint={error}
        keyboardType="number-pad"
        selectTextOnFocus
        submitBehavior={resto.returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
        maxFontSizeMultiplier={maxFontScale}
        value={texto}
        onChangeText={tipear}
        onFocus={(e) => { setFoco(true); resto.onFocus?.(e) }}
        onBlur={() => { setFoco(false); setTexto(mostrar(value)) }}
        style={{
          ...typeScale.titulo,
          ...importe,
          fontSize: 26,
          lineHeight: 32,
          minWidth: compacto ? 56 : 64,
          height: lado,
          paddingVertical: 0,
          textAlign: 'center',
          color: c.text,
          borderRadius: radii.campo,
          borderWidth: conMarca ? 2 : 1,
          borderColor: error ? c.chip.anulado.text : foco ? c.brand : c.border,
          backgroundColor: conMarca ? c.surface : c.surface2,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sumar una de ${nombre}`}
        accessibilityState={{ disabled: !puedeSubir }}
        disabled={!puedeSubir}
        android_ripple={{ color: c.border }}
        onPress={() => onChange(value + paso)}
        style={boton(puedeSubir, true)}
      >
        <ChevronUp size={26} color={puedeSubir ? c.onAction : c.textSecondary} strokeWidth={3} />
      </Pressable>
    </View>
  )
}

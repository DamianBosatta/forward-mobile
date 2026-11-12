import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Building2, ChevronDown, Lock } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'

/**
 * Depósito que se mira, como fila tocable (DepositoDelTablero de la web): lo usan el tablero de preparación y el
 * depósito de la sesión en Inicio. Quien no ve todos los depósitos ve el suyo, fijo, con el aviso de que se lo
 * asignaron. Quien los ve todos lo puede cambiar (`onElegir`). `etiqueta` va arriba del nombre, en chico.
 */
export function DepositoDelTablero({ nombre, asignado, onElegir, etiqueta, testID }: {
  nombre: string
  asignado: boolean
  onElegir?: () => void
  etiqueta?: string
  testID?: string
}) {
  const c = useColors()
  const contenido = (
    <>
      <Building2 size={18} color={c.textSecondary} />
      <View style={{ flex: 1 }}>
        {etiqueta ? <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{etiqueta}</Text> : null}
        <Text style={{ ...(etiqueta ? typeScale.cuerpoDestacado : typeScale.secundario), color: c.text }} numberOfLines={1}>{nombre}</Text>
        {asignado ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Lock size={12} color={c.textSecondary} />
            <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>asignado a tu usuario</Text>
          </View>
        ) : null}
      </View>
      {onElegir ? <ChevronDown size={18} color={c.textSecondary} /> : null}
    </>
  )
  const estilo = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2], minHeight: 44, paddingHorizontal: space[3], paddingVertical: etiqueta ? space[2] : 0, borderRadius: radii.campo, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: onElegir ? c.surface : c.surface2 }
  if (onElegir) {
    return (
      <Pressable testID={testID} onPress={onElegir} android_ripple={{ color: c.surface2 }} accessibilityRole="button" accessibilityLabel={`Depósito: ${nombre}`} accessibilityHint="Elegí qué depósito mirar" style={estilo}>
        {contenido}
      </Pressable>
    )
  }
  return (
    <View testID={testID} accessible accessibilityLabel={`Depósito: ${nombre}${asignado ? ', asignado a tu usuario' : ''}`} style={estilo}>
      {contenido}
    </View>
  )
}

/** Hoja para elegir el depósito (solo con CAP_VER_TODOS_LOS_DEPOSITOS). `null` = todos. `nota` explica qué cambia. */
export function ElegirDepositoSheet({ visible, depositos, elegido, cargando, error, onElegir, onClose, nota }: {
  visible: boolean
  depositos: { id: string; nombre: string }[]
  elegido: string | null
  cargando: boolean
  error: boolean
  onElegir: (id: string | null) => void
  onClose: () => void
  nota?: string
}) {
  const c = useColors()
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Elegir depósito">
      <View testID="hoja-depositos" style={{ gap: space[3] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Depósito</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <FiltroChip label="Todos los depósitos" activo={elegido === null} onPress={() => onElegir(null)} />
          {depositos.map((d) => <FiltroChip key={d.id} label={d.nombre} activo={elegido === d.id} onPress={() => onElegir(d.id)} />)}
        </View>
        {cargando ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Cargando…</Text> : null}
        {error ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>No se pudo cargar la lista de depósitos.</Text> : null}
        {nota ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{nota}</Text> : null}
      </View>
    </BottomSheet>
  )
}

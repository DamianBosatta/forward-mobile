import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Bell, ChevronRight, Monitor } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip } from '@/core/ui/fw'
import type { Aviso } from '@/libs/api-client/notificaciones'
import { avisoDeTipo } from './avisos'
import type { DestinoAviso } from './bandeja'

interface AvisoFilaProps {
  aviso: Pick<Aviso, 'tipo' | 'titulo' | 'mensaje' | 'leida' | 'severidad'>
  destino: DestinoAviso
  cuando: string
  onPress: () => void
}

/** Una fila de la bandeja (lámina M17): etiquetas "Sin leer" y "Crítico" en texto, tipo y hora, título, mensaje y adónde lleva (o que es de la web). */
export function AvisoFila({ aviso, destino, cuando, onPress }: AvisoFilaProps) {
  const c = useColors()
  const tipo = avisoDeTipo(aviso.tipo)
  const Icono = tipo?.Icono ?? Bell
  const critico = aviso.severidad === 'Critica'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={aviso.leida ? aviso.titulo : `${aviso.titulo}, sin leer`}
      android_ripple={{ color: c.surface2 }}
      style={{
        flexDirection: 'row',
        gap: space[3],
        padding: space[4],
        minHeight: 48,
        borderRadius: radii.tarjeta,
        borderWidth: 1,
        borderColor: aviso.leida ? c.border : c.brand,
        backgroundColor: aviso.leida ? c.surface : c.brandSoft,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: radii.pastilla, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icono size={22} color={critico ? c.danger : c.brandInk} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        {!aviso.leida || critico ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] }}>
            {!aviso.leida ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: c.action, borderRadius: radii.pastilla, paddingVertical: space[1], paddingHorizontal: 10 }}>
                <Text style={{ ...typeScale.etiqueta, color: c.onAction }}>Sin leer</Text>
              </View>
            ) : null}
            {critico ? <StatusChip estado="anulado" label="Crítico" /> : null}
          </View>
        ) : null}
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {[tipo?.etiqueta, cuando].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ ...(aviso.leida ? typeScale.cuerpo : typeScale.cuerpoDestacado), color: c.text }}>{aviso.titulo}</Text>
        <Text style={{ ...typeScale.secundario, color: c.text }}>{aviso.mensaje}</Text>
        {destino.tipo === 'ruta' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{destino.etiqueta}</Text>
            <ChevronRight size={18} color={c.brandInk} />
          </View>
        ) : null}
        {destino.tipo === 'web' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Monitor size={16} color={c.textSecondary} />
            <Text style={{ ...typeScale.secundario, color: c.textSecondary, flex: 1 }}>{`${destino.etiqueta}: se abre desde la web`}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

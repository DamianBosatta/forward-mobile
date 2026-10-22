import React from 'react'
import { Text, View } from 'react-native'
import { Inbox, Lock, WifiOff, type LucideIcon } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { partesArgentina } from '@/src/utils/date'
import { Button } from './Button'

export type TipoEstadoDePantalla = 'vacio' | 'sinConexion' | 'sinPermiso'

interface EstadoDePantallaProps {
  tipo: TipoEstadoDePantalla
  titulo: string
  /** Reemplaza el texto de siempre del tipo. */
  texto?: string
  /** Sin conexión: cuándo guardó el teléfono lo que se está mostrando (ms). Sin dato no se inventa la hora. */
  guardadoA?: number
  accion?: { label: string; onPress: () => void }
}

const ICONO: Record<TipoEstadoDePantalla, LucideIcon> = { vacio: Inbox, sinConexion: WifiOff, sinPermiso: Lock }

/** La frase de "sin conexión" (lienzo R16): sirve a la pantalla entera y a un aviso sobre lo ya guardado. Sin hora no se inventa. */
export function textoSinConexion(guardadoA?: number): string {
  if (!guardadoA) return 'Parece que no hay señal. Probá de nuevo en un rato.'
  const p = partesArgentina(guardadoA)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `Parece que no hay señal. Mostramos lo último que guardó el teléfono a las ${dos(p.hora)}:${dos(p.minuto)}.`
}

function textoDeSiempre(tipo: TipoEstadoDePantalla, guardadoA?: number): string | null {
  if (tipo === 'sinPermiso') return 'Si lo necesitás, pedíselo a quien administra los usuarios en la web.'
  if (tipo === 'sinConexion') return textoSinConexion(guardadoA)
  return null
}

/** Lista vacía, sin conexión con el servidor o sin permiso (lienzo R16): el mismo dibujo en toda la app. */
export function EstadoDePantalla({ tipo, titulo, texto, guardadoA, accion }: EstadoDePantallaProps) {
  const c = useColors()
  const Icono = ICONO[tipo]
  const cuerpo = texto ?? textoDeSiempre(tipo, guardadoA)
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[8] }}>
      <View style={{ width: 96, height: 96, borderRadius: radii.pastilla, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icono size={40} color={c.textSecondary} />
      </View>
      <Text accessibilityRole="header" style={[typeScale.titulo, { marginTop: space[2], fontWeight: '700', color: c.text, textAlign: 'center' }]}>
        {titulo}
      </Text>
      {cuerpo ? <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center' }]}>{cuerpo}</Text> : null}
      {accion ? (
        <View style={{ marginTop: space[3] }}>
          <Button label={accion.label} variant="secundario" onPress={accion.onPress} />
        </View>
      ) : null}
    </View>
  )
}

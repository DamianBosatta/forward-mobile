import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Building2, ChevronDown, Inbox, Lock, Shield } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Notice } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { Skeleton } from '@/core/ui/Skeleton'

/**
 * Depósito arriba del tablero (DepositoDelTablero de la web). Quien no ve todos los depósitos ve el suyo, fijo, con
 * el aviso de que se lo asignaron. Quien los ve todos lo puede cambiar (`onElegir`): solo cambia lo que se mira.
 */
export function DepositoDelTablero({ nombre, asignado, onElegir }: { nombre: string; asignado: boolean; onElegir?: () => void }) {
  const c = useColors()
  const contenido = (
    <>
      <Building2 size={18} color={c.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...typeScale.secundario, color: c.text }}>{nombre}</Text>
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
  const estilo = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2], minHeight: 44, paddingHorizontal: space[3], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: onElegir ? c.surface : c.surface2 }
  if (onElegir) {
    return (
      <Pressable onPress={onElegir} android_ripple={{ color: c.surface2 }} accessibilityRole="button" accessibilityLabel={`Depósito: ${nombre}`} accessibilityHint="Elegí qué depósito mirar" style={estilo}>
        {contenido}
      </Pressable>
    )
  }
  return (
    <View accessible accessibilityLabel={`Depósito: ${nombre}${asignado ? ', asignado a tu usuario' : ''}`} style={estilo}>
      {contenido}
    </View>
  )
}

/** Hoja para elegir el depósito que se mira (solo con CAP_VER_TODOS_LOS_DEPOSITOS). `null` = todos. */
export function ElegirDepositoSheet({ visible, depositos, elegido, cargando, error, onElegir, onClose }: {
  visible: boolean
  depositos: { id: string; nombre: string }[]
  elegido: string | null
  cargando: boolean
  error: boolean
  onElegir: (id: string | null) => void
  onClose: () => void
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
      </View>
    </BottomSheet>
  )
}

/** Cargando con la forma del tablero (TableroEsqueleto): pestañas y tarjetas grises, para que nada salte al llegar. */
export function TableroEsqueleto() {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando el tablero de preparación" style={{ gap: space[3] }}>
      <Skeleton width="100%" height={116} borderRadius={radii.campo} />
      <Skeleton width="100%" height={140} borderRadius={radii.tarjeta} />
      <Skeleton width="100%" height={140} borderRadius={radii.tarjeta} />
    </View>
  )
}

/** El tablero no cargó (ErrorTablero): qué pasó, a quién avisarle y Reintentar. Los filtros quedan a la vista. */
export function ErrorTablero({ onReintentar }: { onReintentar: () => void }) {
  return (
    <View style={{ gap: space[3] }}>
      <Notice tone="peligro" title="No pudimos cargar el tablero de preparación">
        Revisá tu conexión y probá de nuevo. Si sigue igual, avisale a Sistemas.
      </Notice>
      <Button label="Reintentar" variant="secundario" onPress={onReintentar} />
    </View>
  )
}

function Estado({ icono: Icono, titulo, texto, children }: { icono: typeof Inbox; titulo: string; texto: string; children?: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ alignItems: 'center', gap: space[3], padding: space[6] }}>
      <View style={{ width: 64, height: 64, borderRadius: radii.pastilla, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icono size={28} color={c.textSecondary} />
      </View>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text, textAlign: 'center' }}>{titulo}</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>{texto}</Text>
      {children}
    </View>
  )
}

/**
 * Ningún pedido en las cuatro columnas (TableroVacio): dice qué se buscó y deja una salida. "Ver todo" saca el
 * filtro de fecha; "Limpiar filtros" vuelve al arranque. Cada botón aparece solo si cambia algo, y solo cambia el filtro.
 */
export function TableroVacio({ nombreDeposito, onVerTodo, onLimpiarFiltros }: { nombreDeposito?: string; onVerTodo?: () => void; onLimpiarFiltros?: () => void }) {
  return (
    <Estado
      icono={Inbox}
      titulo="No hay pedidos para preparar"
      texto={`${nombreDeposito ? `No encontramos pedidos de ${nombreDeposito} con estos filtros.` : 'No encontramos pedidos con estos filtros.'} Probá con otro día o mirá todo lo pendiente.`}
    >
      {onVerTodo || onLimpiarFiltros ? (
        <View style={{ flexDirection: 'row', gap: space[3], alignSelf: 'stretch' }}>
          {onVerTodo ? <View style={{ flex: 1 }}><Button label="Ver todo" onPress={onVerTodo} /></View> : null}
          {onLimpiarFiltros ? <View style={{ flex: 1 }}><Button label="Limpiar filtros" variant="secundario" onPress={onLimpiarFiltros} /></View> : null}
        </View>
      ) : null}
    </Estado>
  )
}

/** Sin el módulo de Viajes (SinAccesoPreparacion): explica por qué y a quién pedirle el permiso. */
export function SinAccesoPreparacion() {
  return (
    <Estado
      icono={Shield}
      titulo="No tenés acceso a Preparación de pedidos"
      texto="Tu usuario no tiene el módulo de Viajes. Pedile a quien administra tu cuenta que te lo habilite."
    />
  )
}

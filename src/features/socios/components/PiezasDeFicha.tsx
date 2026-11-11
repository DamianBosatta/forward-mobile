import React from 'react'
import { Pressable, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'

/** Piezas de la ficha de un socio (clientes y proveedores): dato, acción, sección y cifra. */
export function Dato({ etiqueta, valor, etiquetaChica = false }: { etiqueta: string; valor?: string | null; etiquetaChica?: boolean }) {
  const c = useColors()
  if (!valor?.trim()) return null
  return (
    <View style={{ gap: etiquetaChica ? 2 : space[1] }}>
      {/* `etiquetaChica`: etiqueta 12/600 arriba del valor, como las filas de solo lectura de la venta (ficha de cliente). */}
      <Text style={{ ...(etiquetaChica ? typeScale.etiqueta : typeScale.secundario), color: c.textSecondary }}>{etiqueta}</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.text }}>{valor}</Text>
    </View>
  )
}

/** `sinBorde`: la acción sin contorno (ficha de cliente, propuesta "Clientes como venta"). */
export function Accion({ icono: Icono, label, onPress, sinBorde = false }: { icono: LucideIcon; label: string; onPress: () => void; sinBorde?: boolean }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={{
        flex: 1,
        minWidth: 72,
        minHeight: 64,
        borderRadius: radii.campo,
        backgroundColor: c.surface,
        borderWidth: sinBorde ? 0 : 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[1],
        overflow: 'hidden',
      }}
    >
      <Icono size={22} color={c.brandInk} />
      <Text style={{ ...typeScale.secundario, color: c.text }}>{label}</Text>
    </Pressable>
  )
}

/**
 * Tarjeta sin borde de la ficha o del formulario, con el título adentro si lo hay.
 * `sinRelleno`: sin margen interno, para filas que llegan al borde (compras recientes). `holgada`: separación de 16
 * entre campos, como los grupos del formulario de cliente. Por defecto, la tarjeta de siempre.
 */
export function Seccion({ titulo, children, testID, sinRelleno = false, holgada = false }: {
  titulo?: string; children: React.ReactNode; testID?: string; sinRelleno?: boolean; holgada?: boolean
}) {
  const c = useColors()
  return (
    <View
      testID={testID}
      style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, ...(sinRelleno ? { overflow: 'hidden' } : { padding: space[4], gap: holgada ? space[4] : space[3] }) }}
    >
      {titulo ? <TituloDeSeccion>{titulo}</TituloDeSeccion> : null}
      {children}
    </View>
  )
}

/** Título de un bloque de la ficha (fuera o dentro de su tarjeta). */
export function TituloDeSeccion({ children }: { children: string }) {
  const c = useColors()
  return <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{children}</Text>
}

/** Cifra del resumen de la ficha (saldo, vencido, crédito libre...), como las dice el servidor. */
export function Cifra({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string; alerta?: boolean }) {
  const c = useColors()
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingVertical: space[2],
        paddingHorizontal: space[3],
        borderRadius: radii.tarjeta,
        backgroundColor: alerta ? c.chip.anulado.bg : c.surface,
        borderWidth: alerta ? 0 : 1,
        borderColor: c.border,
      }}
    >
      <Text style={{ ...typeScale.secundario, color: alerta ? c.chip.anulado.text : c.textSecondary }}>{etiqueta}</Text>
      <Text numberOfLines={1} style={[typeScale.cuerpoDestacado, importe, { color: alerta ? c.chip.anulado.text : c.text }]}>{valor}</Text>
    </View>
  )
}

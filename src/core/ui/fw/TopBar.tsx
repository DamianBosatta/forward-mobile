import React, { createContext, useContext } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Menu, type LucideIcon } from 'lucide-react-native'
import { maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { LogoForward } from '@/features/auth/components/LogoForward'
import { Notice } from './Notice'

const TOCABLE = 44

/**
 * Si la barra muestra el aviso global sin conexión. Lo decide OfflineBanner (app/_layout) una sola vez
 * para toda la app: sin señal y fuera de las pantallas con aviso propio. Fuera de él, nunca.
 */
export const AvisoSinConexionContext = createContext(false)

export interface TopBarAction {
  icon: LucideIcon
  accessibilityLabel: string
  onPress: () => void
  /** Se ve atenuada y no responde (p. ej. "Mes siguiente" en el mes en curso). */
  disabled?: boolean
  /** Texto junto al ícono (p. ej. "Transferir"): la acción pasa a ser una pastilla con ícono y texto. Sin él, solo ícono. */
  label?: string
}

export interface TopBarTab {
  label: string
  selected: boolean
  onPress: () => void
}

interface TopBarProps {
  title: string
  subtitle?: string
  /** 'menu' abre el menú lateral; 'atras' vuelve. */
  leading?: { kind: 'menu' | 'atras'; onPress: () => void }
  actions?: TopBarAction[]
  /** Texto junto al punto de sincronizado (p. ej. "Guardado"). */
  syncLabel?: string
  /** Texto suelto a la derecha de la fila del título (p. ej. "Paso 1 de 3"). */
  textoDerecha?: string
  tabs?: TopBarTab[]
  /** El título y el subtítulo pueden ocupar hasta 2 líneas (p. ej. una dirección larga). Por defecto, 1. */
  lineasMultiples?: boolean
  /** Marca FWD entre el botón de la izquierda y el título (propuesta de Inicio). */
  logo?: boolean
  /** Contenido de la fila en lugar del título (p. ej. el campo de Buscar, propuesta de Cuenta). */
  campo?: React.ReactNode
}

/**
 * Barra superior de la lámina F4: alto 64, título 20/600, botones de 44 y pestañas de 48. Sin señal,
 * el aviso global va debajo de la barra (propuesta de Inicio, frame 10), sobre el fondo de la pantalla.
 */
export function TopBar({ title, subtitle, leading, actions = [], syncLabel, textoDerecha, tabs, lineasMultiples = false, logo = false, campo }: TopBarProps) {
  const colors = useColors()
  const avisoSinConexion = useContext(AvisoSinConexionContext)
  const insets = useSafeAreaInsets()
  const Lead = leading?.kind === 'atras' ? ArrowLeft : Menu
  const maxLineas = lineasMultiples ? 2 : 1

  const barra = (
    <View
      style={{
        backgroundColor: colors.topBar,
        paddingTop: insets.top,
        borderBottomWidth: 1,
        borderBottomColor: colors.topBarBorder,
      }}
    >
      <View style={{ ...(lineasMultiples ? { minHeight: 64, paddingVertical: space[1] } : { height: 64 }), flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[1] }}>
        {leading ? (
          <Pressable
            onPress={leading.onPress}
            accessibilityRole="button"
            accessibilityLabel={leading.kind === 'atras' ? 'Volver' : 'Abrir menú'}
            style={{ width: TOCABLE, height: TOCABLE, alignItems: 'center', justifyContent: 'center' }}
          >
            <Lead size={24} color={colors.onTopBarStrong} strokeWidth={2} />
          </Pressable>
        ) : null}
        {logo ? <View style={{ paddingLeft: leading ? 0 : space[3] }}><LogoForward alto={26} /></View> : null}
        {campo ? (
          <View style={{ flex: 1, minWidth: 0, paddingLeft: leading ? 0 : space[3], paddingRight: space[3] }}>
            {/* El campo ocupa el lugar del título: el título queda como encabezado solo para el lector de pantalla. */}
            <Text accessibilityRole="header" numberOfLines={1} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>{title}</Text>
            {campo}
          </View>
        ) : (
          <View style={{ flex: 1, minWidth: 0, paddingLeft: leading || logo ? 0 : space[3] }}>
            <Text accessibilityRole="header" numberOfLines={maxLineas} maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.titulo, color: colors.onTopBarStrong }}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={maxLineas} style={{ ...typeScale.secundario, color: colors.onTopBar }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}
        {textoDerecha ? (
          <Text numberOfLines={1} style={{ ...typeScale.secundario, color: colors.onTopBar, paddingRight: space[3] }}>
            {textoDerecha}
          </Text>
        ) : null}
        {syncLabel ? (
          <View
            accessible
            accessibilityLabel={syncLabel}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], paddingRight: space[3] }}
          >
            <View testID="topbar-sync-dot" style={{ width: space[2], height: space[2], borderRadius: radii.pastilla, backgroundColor: colors.brand }} />
            <Text style={{ ...typeScale.secundario, color: colors.onTopBar }}>{syncLabel}</Text>
          </View>
        ) : null}
        {actions.map(({ icon: Icono, accessibilityLabel, onPress, disabled = false, label }) => (
          <Pressable
            key={accessibilityLabel}
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled }}
            style={
              label
                ? { minWidth: TOCABLE, height: TOCABLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], paddingHorizontal: space[3], borderRadius: radii.campo, backgroundColor: colors.onTopBar + '26', opacity: disabled ? 0.4 : 1 }
                : { width: TOCABLE, height: TOCABLE, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }
            }
          >
            <Icono size={22} color={colors.onTopBarStrong} strokeWidth={2} />
            {label ? <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.cuerpoDestacado, color: colors.onTopBarStrong }}>{label}</Text> : null}
          </Pressable>
        ))}
      </View>
      {tabs?.length ? (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row' }}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.label}
              onPress={tab.onPress}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: tab.selected }}
              style={{
                flex: 1,
                height: space[12],
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: 3,
                borderBottomColor: tab.selected ? colors.brand : 'transparent',
              }}
            >
              <Text
                maxFontSizeMultiplier={maxFontScale}
                style={{
                  ...(tab.selected ? typeScale.cuerpoDestacado : typeScale.cuerpo),
                  color: tab.selected ? colors.onTopBarStrong : colors.onTopBar,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )

  if (!avisoSinConexion) return barra
  return (
    <>
      {barra}
      {/* Debajo de la barra, sobre el fondo: el margen del sistema ya lo puso la barra. */}
      <View testID="aviso-sin-conexion" style={{ paddingTop: space[2], paddingHorizontal: space[4], backgroundColor: colors.bg }}>
        <Notice tone="advertencia">Sin conexión - Modo lectura (Cache)</Notice>
      </View>
    </>
  )
}

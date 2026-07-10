import * as Haptics from 'expo-haptics'

/**
 * Wrapper sobre expo-haptics que oculta el patrón defensivo
 *
 *   Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light || ('Light'.toLowerCase() as any))
 *
 * que estaba repetido más de 100 veces a lo largo de la app y forzaba un
 * `as any` en cada uso. Los enums de Expo pueden ser `undefined` en builds
 * donde el módulo nativo no se cargó (jest sin mock, web preview, etc.),
 * así que igual mantenemos un fallback al string equivalente.
 *
 * Cualquier rechazo de la promesa nativa se silencia: haptics nunca debe
 * tirar abajo un flujo de usuario por un error de hardware.
 */

export type ImpactKind = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
export type NotificationKind = 'success' | 'warning' | 'error'

const impactValue = (kind: ImpactKind): Haptics.ImpactFeedbackStyle => {
  const style = Haptics.ImpactFeedbackStyle
  switch (kind) {
    case 'light':
      return style?.Light ?? ('light' as Haptics.ImpactFeedbackStyle)
    case 'medium':
      return style?.Medium ?? ('medium' as Haptics.ImpactFeedbackStyle)
    case 'heavy':
      return style?.Heavy ?? ('heavy' as Haptics.ImpactFeedbackStyle)
    case 'rigid':
      return style?.Rigid ?? ('rigid' as Haptics.ImpactFeedbackStyle)
    case 'soft':
      return style?.Soft ?? ('soft' as Haptics.ImpactFeedbackStyle)
  }
}

const notificationValue = (kind: NotificationKind): Haptics.NotificationFeedbackType => {
  const type = Haptics.NotificationFeedbackType
  switch (kind) {
    case 'success':
      return type?.Success ?? ('success' as Haptics.NotificationFeedbackType)
    case 'warning':
      return type?.Warning ?? ('warning' as Haptics.NotificationFeedbackType)
    case 'error':
      return type?.Error ?? ('error' as Haptics.NotificationFeedbackType)
  }
}

// Some environments (jest without an expo-haptics mock, web preview, certain
// emulators) return `undefined` from these calls instead of a Promise. We wrap
// with Promise.resolve() so the `.catch` chain is always valid regardless of
// what the runtime gives us — and the catch itself silences any rejection.
const silence = (result: unknown): void => {
  Promise.resolve(result).catch(() => {})
}

export const safeHaptics = {
  impact(kind: ImpactKind): void {
    silence(Haptics.impactAsync(impactValue(kind)))
  },
  notification(kind: NotificationKind): void {
    silence(Haptics.notificationAsync(notificationValue(kind)))
  },
  selection(): void {
    silence(Haptics.selectionAsync())
  },
}

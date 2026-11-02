import { AppState, type AppStateStatus } from 'react-native'
import { focusManager } from '@tanstack/react-query'

/**
 * react-query's focus follows AppState: the app is focused only while `active`. With the app in the
 * background no query with `refetchInterval` polls (A-09). `setEventListener` replaces any previous
 * listener, so calling this again never stacks subscriptions.
 */
export function conectarFocoConAppState(): void {
  focusManager.setEventListener((alCambiarFoco) => {
    const sub = AppState.addEventListener('change', (estado: AppStateStatus) => alCambiarFoco(estado === 'active'))
    return () => sub.remove()
  })
}

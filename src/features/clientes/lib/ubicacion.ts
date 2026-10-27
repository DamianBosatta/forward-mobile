import * as Location from 'expo-location'

export const ERROR_UBICACION = 'No pudimos usar tu ubicación. Escribí la dirección.'

/**
 * Dirección ("Calle 7 1245") del lugar donde está el teléfono, para el botón "Usar mi ubicación" del alta
 * de cliente. Null si no hay permiso, no hay señal o el lugar no tiene calle: el vendedor la escribe.
 */
export async function direccionDeMiUbicacion(): Promise<string | null> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync()
    if (!permiso.granted) return null
    const { coords } = await Location.getCurrentPositionAsync({})
    const [lugar] = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude })
    const calle = lugar?.street?.trim()
    if (!calle) return null
    return [calle, lugar.streetNumber?.trim()].filter(Boolean).join(' ')
  } catch {
    return null
  }
}

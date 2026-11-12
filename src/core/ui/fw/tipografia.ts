import { typeScale } from '@/libs/theme'

/**
 * Pesos de la escala de texto, para resaltar una parte de un texto sin cambiarle el tamaño (por ejemplo
 * `[typeScale.secundario, pesoSemibold]`). Salen de `typeScale`: con Inter el peso va en la familia, así
 * que familia y `fontWeight` viajan juntos.
 */
export const pesoSemibold = { fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: typeScale.cuerpoDestacado.fontWeight }
export const pesoRegular = { fontFamily: typeScale.cuerpo.fontFamily, fontWeight: typeScale.cuerpo.fontWeight }

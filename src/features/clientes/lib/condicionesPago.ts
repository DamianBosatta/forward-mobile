/**
 * Condiciones de pago HABILITADAS de un cliente (varias, exactamente una predeterminada) y la que
 * se elige en cada venta. Port a mobile de la web: `condiciones-pago-cliente-form.ts`,
 * `condicion-pago-venta.ts` y `validarCondicionesPagoCliente` de `packages/validations`.
 * Las reglas de negocio las resuelve la API; acá solo el invariante de la pantalla (con filas, una
 * y solo una predeterminada) y los rangos que evitan el viaje.
 * Deuda X1: la validación vive en la web (packages/validations) y todavía no la copia sync:reglas.
 */
import type { components } from '@/libs/api-client/generated/schema'
import type { TipoCondicionPago } from './cliente'

export type CondicionPagoDto = components['schemas']['CondicionPagoDto']
export type CondicionPagoClienteDto = components['schemas']['CondicionPagoClienteDto']

export const AVISO_NO_COBRAR = 'Si no es contado, la venta va a cuenta corriente y en el manifiesto el chofer ve "NO COBRAR".'
export const AVISO_UNA_PREDETERMINADA = 'La predeterminada es la que se elige sola en cada venta.'
export const AVISO_CONDICIONES_SOLO_LECTURA = 'Solo las cambia quien puede autorizar ventas'

/** Fila del editor: los números son texto de un input; `plazo` son días o el día del mes según el tipo. */
export interface FilaCondicion {
  /** Vacío = todavía no eligió. */
  tipo: TipoCondicionPago | ''
  plazo: string
  predeterminada: boolean
}

export interface ErrorFilaCondicion { tipo?: string; plazo?: string }

const conDias = (t: string) => t === 'DiasDesdeEntrega' || t === 'DiasDesdeFactura'

export function filasDesdeDto(lista?: readonly CondicionPagoClienteDto[] | null): FilaCondicion[] {
  const filas: FilaCondicion[] = (lista ?? []).map((c) => ({
    tipo: c.tipo,
    plazo: String((c.tipo === 'DiaFijoDelMes' ? c.diaDelMes : c.dias) ?? ''),
    predeterminada: c.predeterminada === true,
  }))
  // Defensa: la API garantiza una sola, pero la pantalla nunca queda sin ninguna.
  if (filas.length > 0 && !filas.some((f) => f.predeterminada)) filas[0] = { ...filas[0]!, predeterminada: true }
  return filas
}

/** Fila nueva: sin tipo elegido; es la predeterminada solo si es la primera. */
export const agregarFila = (filas: readonly FilaCondicion[]): FilaCondicion[] =>
  [...filas, { tipo: '', plazo: '', predeterminada: filas.length === 0 }]

export const marcarPredeterminada = (filas: readonly FilaCondicion[], indice: number): FilaCondicion[] =>
  filas.map((f, i) => ({ ...f, predeterminada: i === indice }))

/** Quita una fila; si era la predeterminada pasa a serlo la primera que queda. */
export function quitarFila(filas: readonly FilaCondicion[], indice: number): FilaCondicion[] {
  const resto = filas.filter((_, i) => i !== indice)
  if (resto.length > 0 && !resto.some((f) => f.predeterminada)) resto[0] = { ...resto[0]!, predeterminada: true }
  return resto
}

export const cambiarFila = (filas: readonly FilaCondicion[], indice: number, cambio: Partial<FilaCondicion>): FilaCondicion[] =>
  filas.map((f, i) => (i === indice ? { ...f, ...cambio } : f))

const enteroEnRango = (t: string, min: number, max: number) => /^\d+$/.test(t.trim()) && Number(t) >= min && Number(t) <= max

/** Un error por fila (objeto vacío = bien): tipo elegido, plazo en rango (1-365 / 1-31) y sin repetidas. */
export function validarFilas(filas: readonly FilaCondicion[]): ErrorFilaCondicion[] {
  const vistas = new Set<string>()
  return filas.map((f) => {
    if (!f.tipo) return { tipo: 'Elegí la condición de pago' }
    if (conDias(f.tipo) && !enteroEnRango(f.plazo, 1, 365)) return { plazo: 'Ingresá los días de plazo (entre 1 y 365)' }
    if (f.tipo === 'DiaFijoDelMes' && !enteroEnRango(f.plazo, 1, 31)) return { plazo: 'Ingresá el día del mes (entre 1 y 31)' }
    const clave = f.tipo === 'Contado' ? f.tipo : `${f.tipo}|${Number(f.plazo)}`
    const repetida = vistas.has(clave)
    vistas.add(clave)
    return repetida ? { tipo: 'Hay una condición de pago repetida' } : {}
  })
}

export const hayErrores = (errores: readonly ErrorFilaCondicion[]) => errores.some((e) => e.tipo || e.plazo)

/** La lista como la espera la API: solo el plazo que corresponde al tipo. */
export function filasHaciaDto(filas: readonly FilaCondicion[]): CondicionPagoClienteDto[] {
  return filas.flatMap((f): CondicionPagoClienteDto[] => {
    if (!f.tipo) return []
    if (conDias(f.tipo)) return [{ tipo: f.tipo, dias: Number(f.plazo), predeterminada: f.predeterminada }]
    if (f.tipo === 'DiaFijoDelMes') return [{ tipo: f.tipo, diaDelMes: Number(f.plazo), predeterminada: f.predeterminada }]
    return [{ tipo: f.tipo, predeterminada: f.predeterminada }]
  })
}

const claveFila = (f: FilaCondicion) => `${f.tipo}|${f.tipo === 'Contado' ? '' : f.plazo}|${f.predeterminada}`

/** ¿Cambió la lista respecto de la que se cargó? Sin cambios no se manda (no pide permiso). */
export const filasCambiaron = (inicial: readonly FilaCondicion[], actual: readonly FilaCondicion[]) =>
  inicial.length !== actual.length || inicial.some((f, i) => claveFila(f) !== claveFila(actual[i]!))

// ── La condición de UNA venta ────────────────────────────────────────────────────────────────────

export const CONDICION_CONTADO: CondicionPagoDto = { tipo: 'Contado' }

type Plazo = Pick<CondicionPagoDto, 'tipo' | 'dias' | 'diaDelMes'>

/** Identidad de una condición (tipo + plazo que le corresponde). */
export function claveCondicionPago(c: Plazo): string {
  if (conDias(c.tipo)) return `${c.tipo}:${c.dias}`
  if (c.tipo === 'DiaFijoDelMes') return `${c.tipo}:${c.diaDelMes}`
  return c.tipo
}

export const mismaCondicionPago = (a: Plazo | null | undefined, b: Plazo | null | undefined) =>
  !!a && !!b && claveCondicionPago(a) === claveCondicionPago(b)

/** Solo lo que la API necesita: sin `descripcion` ni `predeterminada`. */
function comoCondicionDeVenta(c: CondicionPagoDto): CondicionPagoDto {
  if (conDias(c.tipo)) return { tipo: c.tipo, dias: c.dias }
  if (c.tipo === 'DiaFijoDelMes') return { tipo: c.tipo, diaDelMes: c.diaDelMes }
  return { tipo: c.tipo }
}

/** La predeterminada del cliente; Contado si no tiene ninguna. */
export function condicionPredeterminadaDelCliente(lista: readonly CondicionPagoClienteDto[] | null | undefined): CondicionPagoDto {
  const elegida = (lista ?? []).find((c) => c.predeterminada) ?? (lista ?? [])[0]
  return elegida ? comoCondicionDeVenta(elegida) : CONDICION_CONTADO
}

export interface OpcionCondicionPagoVenta { condicion: CondicionPagoDto; predeterminada: boolean }

/** Las del cliente (la predeterminada primero) y Contado al final si no estaba: Contado siempre se puede. */
export function opcionesCondicionPagoVenta(lista: readonly CondicionPagoClienteDto[] | null | undefined): OpcionCondicionPagoVenta[] {
  const del = [...(lista ?? [])].sort((a, b) => Number(!!b.predeterminada) - Number(!!a.predeterminada))
  const opciones = del.map((c) => ({ condicion: comoCondicionDeVenta(c), predeterminada: c.predeterminada === true }))
  if (!opciones.some((o) => o.condicion.tipo === 'Contado')) opciones.push({ condicion: CONDICION_CONTADO, predeterminada: false })
  return opciones
}

export interface CondicionPagoVentaResuelta {
  opciones: OpcionCondicionPagoVenta[]
  /** La que muestra el selector; `undefined` = todavía no se sabe. */
  vigente: CondicionPagoDto | undefined
  /** Alta: la vigente. Edición: solo si el usuario la cambió (ausente, el servidor conserva la que tiene). */
  paraEnviar: CondicionPagoDto | undefined
}

export function resolverCondicionPagoVenta(entrada: {
  lista: readonly CondicionPagoClienteDto[] | undefined
  guardada?: CondicionPagoDto | null
  elegida?: CondicionPagoDto
}): CondicionPagoVentaResuelta {
  const { lista, guardada, elegida } = entrada
  const opciones = opcionesCondicionPagoVenta(lista)
  if (guardada && !opciones.some((o) => mismaCondicionPago(o.condicion, guardada))) {
    opciones.unshift({ condicion: comoCondicionDeVenta(guardada), predeterminada: false })
  }
  if (guardada) {
    return {
      opciones,
      vigente: elegida ?? comoCondicionDeVenta(guardada),
      paraEnviar: elegida && !mismaCondicionPago(elegida, guardada) ? elegida : undefined,
    }
  }
  const vigente = elegida ?? (lista ? condicionPredeterminadaDelCliente(lista) : undefined)
  return { opciones: lista ? opciones : [], vigente, paraEnviar: vigente }
}

/**
 * Campos que la API exige en un cliente NUEVO no provisorio (B4-P2). Copia de `CAMPOS_OBLIGATORIOS_CLIENTE`
 * de la web (forward-frontend/packages/validations/src/index.ts); deuda X1 hasta que sync:reglas lo copie.
 */
export const CAMPOS_OBLIGATORIOS_CLIENTE = [
  ['telefono', 'El teléfono es obligatorio en clientes'],
  ['direccion', 'La dirección es obligatoria en clientes'],
  ['nombreFantasia', 'El nombre de fantasía es obligatorio en clientes'],
  ['nombreContacto', 'El nombre de contacto es obligatorio en clientes'],
] as const
export type CampoObligatorioCliente = (typeof CAMPOS_OBLIGATORIOS_CLIENTE)[number][0]

import type { components } from '@/libs/api-client/generated/schema'
import { leerNumero, numeroCompleto } from '@/src/utils/numero'
import { ddmmaaaa, fechaIso } from './fecha'
import { cuitEsValido } from '@/libs/reglas'

export type ComprobanteCompraInput = components['schemas']['ComprobanteCompraInput']
export type ComprobanteRecibido = components['schemas']['ComprobanteRecibidoDto']
export type Letra = components['schemas']['LetraComprobante']
export type Alicuota = components['schemas']['AlicuotaIva']

/** Las alícuotas que se eligen en el teléfono (una por comprobante; varias se cargan en la web). */
export const ALICUOTAS: { value: Alicuota; label: string; tasa: number }[] = [
  { value: 'Veintiuno', label: '21 %', tasa: 0.21 },
  { value: 'DiezComaCinco', label: '10,5 %', tasa: 0.105 },
  { value: 'Veintisiete', label: '27 %', tasa: 0.27 },
]

/**
 * Lo que se tipea del comprobante del proveedor. `base` guarda lo que el teléfono no edita de uno
 * ya cargado (tipo, no gravado, exento, percepciones) para que corregirlo no lo borre: el PUT lo
 * reemplaza entero.
 */
export interface FormComprobante {
  letra: Letra
  puntoVenta: string
  numero: string
  fecha: string
  cuit: string
  razonSocial: string
  total: string
  neto: string
  alicuota: Alicuota
  iva: string
  base?: Pick<ComprobanteCompraInput, 'tipo' | 'noGravado' | 'exento' | 'tributos'>
}

export function formNuevo(proveedor: { cuit?: string | null; razonSocial?: string | null }, hoy: string): FormComprobante {
  return {
    letra: 'A', puntoVenta: '', numero: '', fecha: hoy, cuit: proveedor.cuit ?? '', razonSocial: proveedor.razonSocial ?? '',
    total: '', neto: '', alicuota: 'Veintiuno', iva: '',
  }
}

export function formDesdeComprobante(c: ComprobanteRecibido): FormComprobante {
  const alicuota = c.alicuotas[0]
  return {
    letra: c.letra, puntoVenta: String(c.puntoVenta), numero: String(c.numero), fecha: ddmmaaaa(c.fecha),
    cuit: c.cuitEmisor, razonSocial: c.razonSocialEmisor, total: numeroCompleto(c.total),
    neto: alicuota ? numeroCompleto(alicuota.netoGravado) : '', alicuota: alicuota?.alicuota ?? 'Veintiuno',
    iva: alicuota ? numeroCompleto(alicuota.iva) : '',
    base: { tipo: c.tipo, noGravado: c.noGravado, exento: c.exento, tributos: c.tributos },
  }
}

/** Con más de una alícuota el teléfono no lo puede corregir sin perder datos: va a la web. */
export const seCorrigeEnLaWeb = (c: Pick<ComprobanteRecibido, 'alicuotas'>) => c.alicuotas.length > 1

/** "Factura A 00002-00000055", como figura en el papel. */
export function resumenComprobante(c: Pick<ComprobanteRecibido, 'tipo' | 'letra' | 'puntoVenta' | 'numero'>): string {
  const tipo = { Factura: 'Factura', NotaCredito: 'Nota de crédito', NotaDebito: 'Nota de débito', Recibo: 'Recibo', Ticket: 'Ticket', Otro: 'Comprobante' }[c.tipo]
  return `${tipo} ${c.letra} ${String(c.puntoVenta).padStart(5, '0')}-${String(c.numero).padStart(8, '0')}`
}

const entero = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null)
const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * El cuerpo para el servidor, o qué falta. Valida lo que se puede ver en el teléfono; el resto
 * (rangos fiscales, clave repetida, período cerrado) lo contesta el servidor con su motivo.
 */
export function armarComprobante(f: FormComprobante): { comprobante: ComprobanteCompraInput } | { error: string } {
  const puntoVenta = entero(f.puntoVenta)
  if (!puntoVenta) return { error: 'Falta el punto de venta.' }
  const numero = entero(f.numero)
  if (!numero) return { error: 'Falta el número del comprobante.' }
  const fecha = fechaIso(f.fecha)
  if (!fecha) return { error: 'Escribí la fecha como dd/mm/aaaa.' }
  const cuit = f.cuit.replace(/\D/g, '')
  if (!cuitEsValido(cuit)) return { error: 'El CUIT del proveedor tiene 11 números.' }
  if (!f.razonSocial.trim()) return { error: 'Falta la razón social del proveedor.' }
  const total = leerNumero(f.total)
  if (!total) return { error: 'Falta el total del comprobante.' }

  let alicuotas: ComprobanteCompraInput['alicuotas'] = []
  if (f.letra === 'A') {
    const neto = leerNumero(f.neto)
    if (!neto) return { error: 'En una factura A falta el neto gravado.' }
    const tasa = ALICUOTAS.find((a) => a.value === f.alicuota)?.tasa ?? 0
    const iva = f.iva.trim() ? leerNumero(f.iva) : redondear(neto * tasa)
    if (iva === null) return { error: 'El IVA no es un número.' }
    alicuotas = [{ alicuota: f.alicuota, netoGravado: neto, iva }]
  }

  return {
    comprobante: {
      tipo: f.base?.tipo ?? 'Factura', letra: f.letra, puntoVenta, numero, fecha,
      cuitEmisor: cuit, razonSocialEmisor: f.razonSocial.trim(),
      noGravado: f.base?.noGravado ?? 0, exento: f.base?.exento ?? 0, total, alicuotas, tributos: f.base?.tributos ?? [],
    },
  }
}

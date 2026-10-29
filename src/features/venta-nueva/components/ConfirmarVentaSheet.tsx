import React from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { ventasKeys } from '@/libs/api-client/ventas'
import type { components } from '@/libs/api-client/generated/schema'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { METODO_ENTREGA } from '@/features/ventas/lib/venta-form-retiro'
import type { CabeceraVentaEstado } from '../hooks/useCabeceraVenta'
import type { LineaCarrito } from '../lib/carrito'
import { TiraDeDias } from './TiraDeDias'

/** Por qué no se puede guardar un presupuesto con un descuento sobre el tope (lámina CalleConfirmar). */
export const MOTIVO_PRESUPUESTO_SOBRE_TOPE = 'Un presupuesto no puede pasar tu tope de descuento'

interface Props {
  visible: boolean
  onClose: () => void
  tipo: 'Pedido' | 'Presupuesto'
  /** Editar una venta ya guardada: el botón guarda cambios. */
  edicion: boolean
  cab: CabeceraVentaEstado
  /** Los renglones, para el aviso de stock fiscal de "Con factura". */
  lineas: LineaCarrito[]
  productos: number
  unidades: number
  total: number
  /** Qué va a quedar por autorizar (los motivos que ya se muestran en Líneas). */
  porAutorizar: string[]
  rechazos: string[]
  /** Algún descuento de la venta supera el tope del vendedor. */
  superaTope: boolean
  descuentoValido: boolean
  error: string | null
  enviando: boolean
  onConfirmar: () => void
}

/**
 * V7 "Confirmar pedido" (CalleConfirmar / TabCalleConfirmar): cuándo se entrega, nota para el depósito y el chofer,
 * qué va a quedar por autorizar, el resumen y el botón. La fecha y la nota son las de la pestaña Cabecera. Un
 * presupuesto con un descuento sobre el tope no se puede guardar (el servidor lo rechaza): el botón queda
 * deshabilitado y dice por qué. "Con factura" (como la web): al crear nace con el default del servidor, al editar con el de la venta; se manda lo que quede elegido, con el aviso de stock fiscal.
 */
export function ConfirmarVentaSheet(p: Props) {
  const c = useColors()
  const { cabecera } = p.cab
  const esPedido = p.tipo === 'Pedido'
  const titulo = p.edicion ? 'Guardar cambios' : esPedido ? 'Confirmar pedido' : 'Guardar presupuesto'
  const presupuestoSobreTope = !esPedido && p.superaTope
  const deshabilitado = p.productos === 0 || !p.descuentoValido || p.cab.fleteInvalido || !!p.cab.cesionError || p.enviando || presupuestoSobreTope
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  return (
    <BottomSheet visible={p.visible} onClose={p.onClose} accessibilityLabel="Confirmar venta">
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{titulo}</Text>
      {cabecera.metodoEntrega !== METODO_ENTREGA.RetiroEnLocal ? (
        <View style={{ gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>¿Cuándo se entrega?</Text>
          {p.cab.calendarioError ? <Notice tone="peligro">No se pudo traer el calendario de entregas.</Notice> : null}
          {cabecera.fecha ? null : <Text style={secundario}>Sin fecha: elegí el día de entrega.</Text>}
          <TiraDeDias cab={p.cab} />
          {cabecera.flete > 0 ? <Text style={{ ...secundario, ...importe }}>{`Logística propia · flete ${formatImporte(cabecera.flete)}`}</Text> : null}
        </View>
      ) : <Text style={secundario}>Retira en el local: sin flete.</Text>}
      <Field label="Nota para el depósito y el chofer" multiline maxLength={500} value={p.cab.observaciones} onChangeText={p.cab.setObservaciones}
        placeholder="Ej.: entrar por el portón de atrás." />
      <ConFactura conFactura={cabecera.conFactura} onChange={p.cab.setConFactura} lineas={p.lineas} />
      {p.rechazos.map((r) => <Notice key={r} tone="peligro">{r}</Notice>)}
      {esPedido && p.porAutorizar.length > 0 ? (
        <Notice tone="advertencia" title="Queda por autorizar">
          {`Porque ${p.porAutorizar.join(', ')}. Te avisamos cuando gestión lo resuelva.`}
        </Notice>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={secundario}>{`${p.productos} ${p.productos === 1 ? 'producto' : 'productos'} · ${p.unidades} ${p.unidades === 1 ? 'unidad' : 'unidades'}`}</Text>
        <Text testID="confirmar-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(p.total)}</Text>
      </View>
      {p.error ? <Notice tone="peligro">{p.error}</Notice> : null}
      <Button label={titulo} onPress={p.onConfirmar} loading={p.enviando} disabled={deshabilitado} />
      {presupuestoSobreTope ? <MotivoDeshabilitado>{MOTIVO_PRESUPUESTO_SOBRE_TOPE}</MotivoDeshabilitado> : null}
    </BottomSheet>
  )
}

/** Misma regla que la web (con-factura.ts, cuentaDeLaVenta): con factura la deuda va a la cuenta Normal, sin factura a la TST. */
const cuentaDeLaVenta = (conFactura: boolean) => (conFactura ? 'Normal' : 'TST')

type FaltanteStockFiscal = components['schemas']['FaltanteStockFiscalDto']

/** Los renglones que se consultan (itemsParaVerificar de la web): sin producto o sin cantidad no hay nada que verificar. */
const itemsParaVerificar = (lineas: LineaCarrito[]) =>
  lineas.filter((l) => Boolean(l.productoId) && l.cantidad > 0).map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }))

/** describirFaltanteFiscal de la web (con-factura.ts): sin los números (quien no ve el stock) va solo el nombre. */
const describirFaltanteFiscal = (f: FaltanteStockFiscal) =>
  f.cantidad == null || f.stockFiscal == null
    ? `${f.nombre}: no alcanza el stock fiscal`
    : `${f.nombre}: pide ${f.cantidad}, hay ${f.stockFiscal} en stock fiscal`

/**
 * Interruptor "Con factura" (CalleConfirmar) con el aviso de stock fiscal de la web (ConFacturaField, regla F5): solo con el
 * tilde puesto consulta POST /Ventas/stock-fiscal/verificar y avisa; nunca bloquea (K12). Sin valor (el default no llegó)
 * queda apagado y deshabilitado.
 */
export function ConFactura({ conFactura, onChange, lineas }: { conFactura: boolean | undefined; onChange: (v: boolean) => void; lineas: LineaCarrito[] }) {
  const c = useColors()
  const valor = conFactura ?? false
  const items = useMemo(() => itemsParaVerificar(lineas), [lineas])
  const verificacion = useQuery({
    queryKey: [...ventasKeys.all, 'stock-fiscal', items] as const,
    queryFn: () => api.post<FaltanteStockFiscal[]>('/api/v1/Ventas/stock-fiscal/verificar', { items }),
    enabled: conFactura === true && items.length > 0,
    staleTime: 15_000,
  })
  const faltantes = conFactura === true && Array.isArray(verificacion.data) ? verificacion.data : []
  return (
    <View style={{ gap: space[2] }}>
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Con factura"
      accessibilityState={{ checked: valor, disabled: conFactura === undefined }}
      disabled={conFactura === undefined}
      onPress={() => onChange(!valor)}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Con factura</Text>
        {conFactura !== undefined ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`La deuda va a la cuenta ${cuentaDeLaVenta(conFactura)} del cliente.`}</Text> : null}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Switch value={valor} disabled={conFactura === undefined} trackColor={{ false: c.border, true: c.action }} />
      </View>
    </Pressable>
    {faltantes.length > 0 ? (
      <Notice tone="advertencia" title="El stock fiscal no alcanza:">
        {[...faltantes.map(describirFaltanteFiscal), 'Podés confirmar igual: el stock fiscal queda negativo y sale la alerta.'].join('\n')}
      </Notice>
    ) : null}
    </View>
  )
}

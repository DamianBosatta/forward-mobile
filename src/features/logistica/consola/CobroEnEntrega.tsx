import React from 'react'
import { Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, formatImporte, Field, Notice, Segmented } from '@/core/ui/fw'
import type { MedioCobroChofer } from '@/libs/api-client/logistica'
import { ElegirChip } from '@/features/cuentas/components/ElegirChip'
import { FotoEntrega } from './FotoEntrega'
import type { ChequeForm, Imputacion, LineaCobroForm } from './entrega'

interface Props {
  medios: MedioCobroChofer[] | undefined
  mediosError: boolean
  lineas: LineaCobroForm[]
  imputacion: Imputacion
  onLineas: (lineas: LineaCobroForm[]) => void
  onImputacion: (i: Imputacion) => void
  onSubiendo: (subiendo: boolean) => void
  /** dd/mm/aaaa de hoy, para precargar las fechas del cheque. */
  hoy: string
  /** Lámina ChoferEntrega: lo que hay que cobrar en la parada (lo decide el servidor). */
  aCobrar?: number | null
  /** Lámina Cobro: lo repartido entre los medios ("$ 600,00 de $ 1.000,00 ✓"), si hay algo que mostrar. */
  repartido?: string
  /** "Faltan $ X" / "Sobran $ X" en rojo bajo lo repartido: avisa, no frena. */
  aviso?: string | null
  /** Paso E4 ("paga lo anterior y firma lo actual"): el cobro va a la deuda vieja. */
  porDeudaAnterior?: boolean
}

/** Lo que cobró el chofer: una o varias líneas (efectivo, transferencia, cheque). El servidor imputa y valida. */
export function CobroEnEntrega({ medios, mediosError, lineas, imputacion, onLineas, onImputacion, onSubiendo, hoy, aCobrar, repartido, aviso, porDeudaAnterior }: Props) {
  const c = useColors()
  const cambiar = (i: number, cambio: Partial<LineaCobroForm>) => onLineas(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)))
  const cambiarCheque = (i: number, campo: keyof ChequeForm) => (v: string) =>
    cambiar(i, { cheque: { ...lineas[i].cheque, [campo]: v } })
  const agregar = () =>
    onLineas([...lineas, { medio: null, monto: '', fotoUrl: null, cheque: { numero: '', banco: '', titular: '', emision: hoy, pago: hoy } }])

  return (
    <View accessibilityLabel="Cobro" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...typeScale.seccion, color: c.text }}>Cobro</Text>
        {aCobrar != null ? (
          <Text accessibilityLabel="A cobrar hoy" style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {'A cobrar hoy '}
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{formatImporte(aCobrar)}</Text>
          </Text>
        ) : null}
      </View>
      {lineas.length === 0 ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Sin cobro: el pedido queda en la cuenta del cliente.</Text>
      ) : null}
      {mediosError ? <Notice tone="peligro">No se pudieron cargar los medios de cobro.</Notice> : null}
      {lineas.map((l, i) => {
        const n = i + 1
        return (
          <View key={i} style={{ gap: space[2], paddingTop: space[2], borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border }}>
            <ElegirChip
              titulo={`Medio del cobro ${n}`}
              opciones={(medios ?? []).map((m) => ({ id: m.id, label: m.nombre }))}
              valor={l.medio?.id ?? null}
              onCambio={(id) => cambiar(i, { medio: medios?.find((m) => m.id === id) ?? null, fotoUrl: null })}
            />
            <Field label={`Monto del cobro ${n}`} value={l.monto} onChangeText={(v) => cambiar(i, { monto: v })} keyboardType="decimal-pad" alignRight />
            {l.medio?.tipo === 'Cheque' ? (
              <>
                <Field label={`N.º de cheque (cobro ${n})`} value={l.cheque.numero} onChangeText={cambiarCheque(i, 'numero')} />
                <Field label={`Banco (cobro ${n})`} value={l.cheque.banco} onChangeText={cambiarCheque(i, 'banco')} />
                <Field label={`Titular (cobro ${n})`} value={l.cheque.titular} onChangeText={cambiarCheque(i, 'titular')} />
                <Field label={`Fecha de emisión (cobro ${n})`} value={l.cheque.emision} onChangeText={cambiarCheque(i, 'emision')} help="dd/mm/aaaa" />
                <Field label={`Fecha de pago (cobro ${n})`} value={l.cheque.pago} onChangeText={cambiarCheque(i, 'pago')} help="dd/mm/aaaa" />
              </>
            ) : null}
            {l.medio ? (
              <FotoEntrega
                que={`${l.medio.tipo === 'Cheque' ? 'del cheque' : 'del comprobante'} del cobro ${n}`}
                ayuda={l.medio.tipo === 'Transferencia' ? 'La transferencia necesita la captura del comprobante.' : undefined}
                url={l.fotoUrl}
                onUrl={(url) => cambiar(i, { fotoUrl: url })}
                onSubiendo={onSubiendo}
              />
            ) : null}
            <Button label={`Quitar cobro ${n}`} variant="secundario" onPress={() => onLineas(lineas.filter((_, j) => j !== i))} />
          </View>
        )
      })}
      <Button label="Agregar cobro" variant="secundario" onPress={agregar} />
      {repartido ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Repartido</Text>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{repartido}</Text>
        </View>
      ) : null}
      {aviso ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.danger, textAlign: 'right' }}>{aviso}</Text> : null}
      {lineas.length > 0 && porDeudaAnterior ? (
        <Notice tone="info">El cobro va a la deuda más vieja del cliente. Lo de hoy se firma abajo y queda en su cuenta corriente.</Notice>
      ) : null}
      {lineas.length > 0 ? (
        <Segmented<Imputacion>
          accessibilityLabel="A qué deuda va el cobro"
          value={imputacion}
          onChange={onImputacion}
          options={[
            { value: 'PedidoActual', label: 'Al pedido de hoy' },
            { value: 'DeudaAnterior', label: 'A la deuda anterior' },
          ]}
        />
      ) : null}
    </View>
  )
}

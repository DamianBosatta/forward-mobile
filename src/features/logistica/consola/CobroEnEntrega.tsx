import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Landmark, X } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, formatImporte, Field, Notice, OptionCard, Segmented } from '@/core/ui/fw'
import type { MedioCobroChofer } from '@/libs/api-client/logistica'
import { FotoEntrega } from './FotoEntrega'
import { MAX_OTRO_NO_COBRO, MOTIVOS_NO_COBRO, type ChequeForm, type Imputacion, type LineaCobroForm, type MotivoNoCobro, type NoCobroForm } from './entrega'

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
  /** Lo que falta cobrar y queda en la cuenta corriente (chofer-04--mixto), si hay algo que decir. */
  faltaACuenta?: number | null
  /** "Sobran $ X" en rojo bajo los pagos: avisa, no frena. */
  aviso?: string | null
  /** Paso E4 ("paga lo anterior y firma lo actual"): el cobro va a la deuda vieja. */
  porDeudaAnterior?: boolean
  /** Lámina ChoferEntrega (C2): "Cuenta corriente" con su motivo. Solo se ofrece si hay algo para cobrar (`aCobrar`). */
  noCobro?: NoCobroForm | null
  onNoCobro?: (n: NoCobroForm | null) => void
}

/** Lo que se dice de cada medio, en una línea (chofer-04). El servidor decide qué medios hay y cómo se llaman. */
const DETALLE_MEDIO: Partial<Record<string, string>> = { Transferencia: 'Foto del comprobante', Cheque: 'Foto y datos' }

/**
 * Lámina chofer-04: cómo paga el cliente. Opciones grandes de 76 px (los medios del servidor más "Cuenta
 * corriente"), pagos ya cargados con su X de 44 px y "Sumar otro pago". El servidor imputa y valida.
 */
export function CobroEnEntrega({ medios, mediosError, lineas, imputacion, onLineas, onImputacion, onSubiendo, hoy, aCobrar, faltaACuenta, aviso, porDeudaAnterior, noCobro, onNoCobro }: Props) {
  const c = useColors()
  const [agregando, setAgregando] = useState(false)
  const ofreceNoCobre = aCobrar != null && !!onNoCobro
  if (ofreceNoCobre && noCobro) {
    return (
      <View accessibilityLabel="Cobro" style={{ gap: space[3] }}>
        <EncabezadoCobro aCobrar={aCobrar} />
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>Queda en cuenta corriente</Text>
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{`Se anotan ${formatImporte(aCobrar)} de deuda. ¿Por qué no cobraste?`}</Text>
        <View accessibilityLabel="Por qué no cobró" style={{ gap: space[2] }}>
          {MOTIVOS_NO_COBRO.map((m) => (
            <OptionCard key={m} label={m} selected={noCobro.motivo === m} onPress={() => onNoCobro({ ...noCobro, motivo: m as MotivoNoCobro })} />
          ))}
        </View>
        {noCobro.motivo === 'Otro' ? (
          <Field label="Por qué no cobraste" value={noCobro.otro} onChangeText={(otro) => onNoCobro({ ...noCobro, otro })} maxLength={MAX_OTRO_NO_COBRO} />
        ) : null}
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>El motivo queda en las observaciones de la entrega y el pedido, en la cuenta del cliente.</Text>
        <Button label="Cobré algo" variant="secundario" onPress={() => onNoCobro(null)} />
      </View>
    )
  }
  const cambiar = (i: number, cambio: Partial<LineaCobroForm>) => onLineas(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)))
  const cambiarCheque = (i: number, campo: keyof ChequeForm) => (v: string) =>
    cambiar(i, { cheque: { ...lineas[i].cheque, [campo]: v } })
  const agregar = (medio: MedioCobroChofer) => {
    onLineas([...lineas, { medio, monto: '', fotoUrl: null, cheque: { numero: '', banco: '', titular: '', emision: hoy, pago: hoy } }])
    setAgregando(false)
  }
  const elegirMedio = lineas.length === 0 || agregando

  return (
    <View accessibilityLabel="Cobro" style={{ gap: space[3] }}>
      <EncabezadoCobro aCobrar={aCobrar} />
      {mediosError ? <Notice tone="peligro">No se pudieron cargar los medios de cobro.</Notice> : null}
      {lineas.length > 0 ? <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Pagos de hoy</Text> : null}
      {lineas.map((l, i) => {
        const n = i + 1
        return (
          <View key={i} accessibilityLabel={`Cobro ${n}`} style={{ gap: space[2], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 2, borderColor: c.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <View accessibilityLabel={`Medio del cobro ${n}`} style={{ flex: 1 }}>
                <Text style={{ ...typeScale.seccion, color: c.text }}>{l.medio?.nombre ?? 'Sin medio'}</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Pago ${n}`}</Text>
              </View>
              <Pressable
                onPress={() => onLineas(lineas.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Quitar cobro ${n}`}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo, borderWidth: 2, borderColor: c.textSecondary }}
              >
                <X size={22} color={c.text} strokeWidth={3} />
              </Pressable>
            </View>
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
          </View>
        )
      })}
      {aviso ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.danger, textAlign: 'right' }}>{aviso}</Text> : null}
      {faltaACuenta ? <Notice tone="info">{`Los ${formatImporte(faltaACuenta)} que faltan quedan en su cuenta corriente.`}</Notice> : null}
      {lineas.length > 0 && porDeudaAnterior ? (
        <Notice tone="info">El cobro va a la deuda más vieja del cliente. Lo de hoy queda en su cuenta corriente.</Notice>
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
      {elegirMedio ? (
        <View accessibilityLabel={lineas.length === 0 ? '¿Cómo paga?' : 'Sumar otro pago'} style={{ gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>{lineas.length === 0 ? '¿Cómo paga?' : 'Sumar otro pago'}</Text>
          {(medios ?? []).map((m) => (
            <OptionCard key={m.id} label={m.nombre} detail={DETALLE_MEDIO[m.tipo]} onPress={() => agregar(m)} />
          ))}
          {ofreceNoCobre && lineas.length === 0 ? (
            <OptionCard icon={Landmark} label="Cuenta corriente" detail="Queda como deuda" onPress={() => onNoCobro({ motivo: null, otro: '' })} />
          ) : null}
          {lineas.length > 0 ? <Button label="No sumo otro" variant="secundario" onPress={() => setAgregando(false)} /> : null}
        </View>
      ) : (
        <Button label="Sumar otro pago" variant="secundario" onPress={() => setAgregando(true)} />
      )}
    </View>
  )
}

function EncabezadoCobro({ aCobrar }: { aCobrar?: number | null }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={{ ...typeScale.seccion, color: c.text }}>Cobro</Text>
      {aCobrar != null ? (
        <Text accessibilityLabel="A cobrar hoy" style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {'A cobrar hoy '}
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{formatImporte(aCobrar)}</Text>
        </Text>
      ) : null}
    </View>
  )
}

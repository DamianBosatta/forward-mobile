import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, FormContainer, Notice, PieFijo, TopBar, formatImporte, formatPorcentaje } from '@/core/ui/fw'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import type { CajaDelCobro, MedioDePago } from '../api/cobros'
import { subirFotoCheque } from '../api/fotos'
import type { FormCobro } from '../lib/cobro'
import { condicionesDelMedio } from '../lib/condicionesMedio'
import type { BorradorMedio } from '../lib/lineasCobro'
import { CajaDelCobroInline } from './CajaDelCobroInline'
import { DestinoDelCobro } from './DestinoDelCobro'
import { ElegirChip } from './ElegirChip'
import { FotoDelCobro } from './FotoDelCobro'

interface Props {
  medios: MedioDePago[]
  cargandoMedios: boolean
  errorMedios: unknown
  borrador: BorradorMedio
  onCambio: (b: BorradorMedio) => void
  /** La primera línea del cobro: la única con cuenta donde entró, foto del comprobante y datos del cheque. */
  primera: boolean
  /** La caja del depósito de la sesión, donde entra el efectivo (no se elige acá). */
  caja: CajaDelCobro
  subeFotoCheque: boolean
  onSubiendo: (subiendo: boolean) => void
  /** Por qué todavía no se puede agregar; `null` si se puede. */
  motivo: string | null
  /** Editando un medio ya agregado: el botón dice "Guardar" y la barra tiene el tacho. */
  editando: boolean
  onGuardar: () => void
  onQuitar: () => void
  onVolver: () => void
}

/**
 * "Medio y monto" (maqueta "Cobros como venta", frames 7 a 9; el lugar de "Cantidad y oferta" en la venta): un
 * medio con su monto y lo que ese medio pide. Efectivo: la caja del depósito de la sesión, donde entra (no se elige).
 * Transferencia o depósito: la cuenta donde entró y la foto del comprobante. Cheque: sus datos y su foto. Comisión, neto y acreditación son solo
 * informativos. Los mismos componentes y textos que el formulario de siempre.
 */
export function MedioYMonto(p: Props) {
  const c = useColors()
  const { borrador: b, onCambio } = p
  const medio = p.medios.find(m => m.id === b.medioPagoId)
  const condiciones = condicionesDelMedio(medio, leerNumero(b.monto))
  const cheque = (campo: keyof FormCobro['cheque']) => (v: string) => onCambio({ ...b, cheque: { ...b.cheque, [campo]: v } })
  const elegir = (id: string) => {
    const m = p.medios.find(x => x.id === id)
    onCambio({ ...b, medioPagoId: id, cuentaPropiaId: null, esCheque: !!m?.esCheque, requiereCaja: !!m?.requiereCaja })
  }

  return (
    <View style={{ flex: 1 }}>
      <TopBar
        title="Medio y monto"
        subtitle={medio?.nombre ?? undefined}
        leading={{ kind: 'atras', onPress: p.onVolver }}
        actions={p.editando ? [{ icon: Trash2, accessibilityLabel: 'Quitar este medio', onPress: p.onQuitar }] : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        <FormContainer style={{ gap: space[4] }}>
          {p.cargandoMedios ? <ActivityIndicator color={c.brandInk} /> : null}
          {p.errorMedios ? <Notice tone="peligro">{mensajeDelServidor(p.errorMedios, 'No se pudieron cargar los medios de pago.')}</Notice> : null}
          <ElegirChip titulo="Medio" tituloVisible opciones={p.medios.filter(m => m.activo && m.id).map(m => ({ id: m.id!, label: m.nombre ?? '' }))} valor={b.medioPagoId} onCambio={elegir} />
          {b.esCheque ? <Notice tone="info">El cheque se carga en un cobro de un solo medio.</Notice> : null}
          <Field label="Monto" value={b.monto} onChangeText={v => onCambio({ ...b, monto: v })} keyboardType="decimal-pad" alignRight />
          {condiciones ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
              {[
                `Comisión ${formatPorcentaje(condiciones.comisionPorcentaje)}${condiciones.comision != null ? ` · ${formatImporte(condiciones.comision)}` : ''}`,
                condiciones.neto != null ? `Neto ${formatImporte(condiciones.neto)}` : null,
                condiciones.diasAcreditacion > 0 ? `Se acredita en ${condiciones.diasAcreditacion} ${condiciones.diasAcreditacion === 1 ? 'día' : 'días'}` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {b.requiereCaja ? <CajaDelCobroInline caja={p.caja} /> : null}

          {p.primera && b.esCheque ? (
            <>
              <Field label="N.º de cheque" value={b.cheque.numero} onChangeText={cheque('numero')} />
              <Field label="Banco" value={b.cheque.banco} onChangeText={cheque('banco')} />
              <Field label="Titular" value={b.cheque.titular} onChangeText={cheque('titular')} />
              <Field label="Fecha de emisión" value={b.cheque.emision} onChangeText={cheque('emision')} help="dd/mm/aaaa" />
              <Field label="Fecha de pago" value={b.cheque.pago} onChangeText={cheque('pago')} help="dd/mm/aaaa" />
              {p.subeFotoCheque ? (
                <FotoDelCobro que="del cheque" url={b.chequeFotoUrl} subir={subirFotoCheque} onUrl={u => onCambio({ ...b, chequeFotoUrl: u })} onSubiendo={p.onSubiendo} />
              ) : null}
            </>
          ) : null}
          {p.primera && medio && !b.requiereCaja && !b.esCheque ? (
            <DestinoDelCobro
              medio={medio}
              cuentaPropiaId={b.cuentaPropiaId}
              comprobanteUrl={b.comprobanteUrl}
              onCuenta={id => onCambio({ ...b, cuentaPropiaId: id })}
              onComprobante={u => onCambio({ ...b, comprobanteUrl: u })}
              onSubiendo={p.onSubiendo}
            />
          ) : null}
          {!p.primera && medio && !b.requiereCaja ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>La cuenta de este medio la pone el servidor.</Text>
          ) : null}
        </FormContainer>
      </ScrollView>
      <PieFijo>
        {p.motivo ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{p.motivo}</Text> : null}
        <Button label={p.editando ? 'Guardar este medio' : 'Agregar este medio'} icon={p.editando ? undefined : Plus} disabled={!!p.motivo} onPress={p.onGuardar} />
      </PieFijo>
    </View>
  )
}

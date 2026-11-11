import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { ArrowDown, Check } from 'lucide-react-native'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { Button, Field, FormContainer, Notice, PieFijo, formatImporte } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { useCuentasPropias, type CuentaParaCobrar } from '@/features/cuentas/api/cobros'
import { useRegistrarMovimientoInterno, useSaldoRestante, useTiposMovimientoInterno, type SaldoRestante } from '../api/movimientosInternos'
import { ElegirChip } from '@/features/cuentas/components/ElegirChip'
import { ElegirCuenta } from './ElegirCuenta'
import { MontoGrande } from './MontoGrande'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'

/** Valor de "Hacia" cuando la plata sale del sistema (un retiro): el servidor no recibe destino. */
export const SIN_DESTINO = 'sin-destino'

/** Aclaración de la lámina ModTransferencia: un cliente que paga por transferencia se carga como cobro. */
export const AVISO_COBRO_DE_CLIENTE = 'Si un cliente te transfirió, cargalo con "Cobrar" desde su ficha.'

/** Línea de la lámina tesoreria-transferencia: dice por qué no aparecen clientes ni cartera de cheques. */
export const AVISO_SOLO_CUENTAS_PROPIAS = 'Solo se eligen cuentas propias: los clientes y la cartera de cheques no aparecen.'

/** Espera antes de preguntar el saldo que queda, para no pedirlo con cada tecla del monto. */
const ESPERA_SALDO_MS = 400

/** El N.º de operación no tiene campo en el servidor: viaja delante de la nota, como "Op. 123 · nota". */
export function observacionesConOperacion(operacion: string, nota: string): string | null {
  const op = operacion.trim()
  const texto = nota.trim()
  return [op ? `Op. ${op}` : '', texto].filter(Boolean).join(' · ') || null
}

/**
 * Movimiento entre cuentas propias (lámina Transferencia): tipo del catálogo, desde, hacia, monto
 * y observaciones. Sin destino la plata sale del sistema y hay que decir quién se la lleva.
 * Las cuentas salen de la lista liviana (`propias/para-cobrar`, sin saldos; con un servidor anterior,
 * de `propias` con su saldo) y lo que queda en la de origen lo calcula el servidor (`saldo-restante`).
 */
export function Transferencia({ onListo }: { onListo: () => void }) {
  const c = useColors()
  const tipos = useTiposMovimientoInterno()
  const { canRead, canDo } = usePermissions()
  // Como la web: sin MOD_PAGOS:Create el botón no desaparece, se deshabilita y dice por qué.
  const puedeRegistrar = canDo('MOD_PAGOS', 'create')
  const cuentas = useCuentasPropias(puedeRegistrar, canRead('MOD_CC'))
  const registrar = useRegistrarMovimientoInterno()
  const [tipoId, setTipoId] = useState<string | null>(null)
  const [origen, setOrigen] = useState<string | null>(null)
  const [destino, setDestino] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [operacion, setOperacion] = useState('')
  const [retira, setRetira] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const montoConsultado = useDebouncedValue(leerNumero(monto), ESPERA_SALDO_MS)
  const restante = useSaldoRestante(origen, montoConsultado, canRead('MOD_CC'))

  if (hecho) return <MovimientoRegistrado onVolver={onListo} />

  const enviar = () => {
    if (registrar.isPending) return
    const n = leerNumero(monto)
    const falta =
      !tipoId ? 'Elegí el tipo de movimiento.'
      : !origen ? 'Elegí la cuenta de origen.'
      : !destino ? 'Elegí la cuenta de destino (o que la plata sale).'
      : n === null || n <= 0 ? 'Ingresá el monto.'
      : destino === SIN_DESTINO && !retira.trim() ? 'Decí quién se lleva la plata.'
      : null
    setAviso(falta)
    if (falta || !tipoId || !origen || n === null) return
    const sale = destino === SIN_DESTINO
    registrar.mutate(
      {
        tipoMovimientoInternoId: tipoId,
        cuentaOrigenId: origen,
        cuentaDestinoId: sale ? null : destino,
        monto: n,
        observaciones: observacionesConOperacion(operacion, observaciones),
        retiradoPorNombre: sale ? retira.trim() : null,
      },
      { onSuccess: () => setHecho(true) },
    )
  }

  // El servidor no acepta la cartera de cheques ni la caja de efectivo en una transferencia
  // (useCuentasPropias ya las saca).
  const propias: CuentaParaCobrar[] = cuentas.data ?? []
  const nombreOrigen = propias.find(k => k.id === origen)?.nombre
  const tarjeta = { borderRadius: radii.tarjeta, backgroundColor: c.surface }
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        {/* Propuesta "Finanzas como venta", frames 10 a 12: monto grande y tarjetas sin borde, como Entrega y facturación de la venta. */}
        <FormContainer style={{ gap: space[4] }}>
          {tipos.isLoading || cuentas.isLoading ? <Esqueletos bloques={[{ alto: 76 }]} /> : null}
          {tipos.error ? <Notice tone="peligro">{mensajeDelServidor(tipos.error, 'No se pudieron cargar los tipos.')}</Notice> : null}
          {cuentas.error ? <Notice tone="peligro">{mensajeDelServidor(cuentas.error, 'No se pudieron cargar las cuentas.')}</Notice> : null}

          {/* Lo que queda en la cuenta de origen (lo calcula el servidor) va justo debajo del monto (frame 11). */}
          <View testID="bloque-monto" style={{ gap: space[2] }}>
            <MontoGrande value={monto} onChangeText={setMonto} />
            {restante.data && nombreOrigen && restante.data.monto === leerNumero(monto) ? <SaldoQueQueda saldo={restante.data} cuenta={nombreOrigen} /> : null}
          </View>

          <View testID="tarjeta-tipo" style={{ ...tarjeta, padding: space[4] }}>
            <ElegirChip
              titulo="Tipo"
              tituloVisible
              opciones={(tipos.data ?? []).filter(t => t.activo && t.id).map(t => ({ id: t.id!, label: t.nombre ?? '' }))}
              valor={tipoId}
              onCambio={setTipoId}
              conTilde
            />
          </View>

          {/* "Desde → Hacia" en una tarjeta conectada; elegida, "Desde" se pliega a una fila con "Cambiar" (frame 11). */}
          <View testID="tarjeta-cuentas" style={{ ...tarjeta, overflow: 'hidden' }}>
            <ElegirCuenta plano titulo="Desde" cuentas={propias} valor={origen} onCambio={id => { setOrigen(id); if (id === destino) setDestino(null) }} />
            <View style={{ height: 1, backgroundColor: c.surface2, justifyContent: 'center', alignItems: 'flex-end', paddingRight: space[6] }}>
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
              >
                <ArrowDown size={16} color={c.textSecondary} strokeWidth={2} />
              </View>
            </View>
            <ElegirCuenta
              plano
              titulo="Hacia"
              cuentas={propias.filter(k => k.id !== origen)}
              valor={destino}
              onCambio={setDestino}
              extra={{ valor: SIN_DESTINO, label: 'Ninguna: la plata sale (retiro)' }}
            />
            {destino === SIN_DESTINO ? (
              <View style={{ paddingHorizontal: space[2], paddingBottom: space[3] }}>
                <Field label="Quién se la lleva" value={retira} onChangeText={setRetira} />
              </View>
            ) : null}
          </View>

          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{AVISO_SOLO_CUENTAS_PROPIAS}</Text>
          <View style={{ ...tarjeta, padding: space[4], gap: space[3] }}>
            <Field label="N.º de operación (opcional)" value={operacion} onChangeText={setOperacion} />
            <Field label="Observaciones (opcional)" value={observaciones} onChangeText={setObservaciones} />
          </View>
          <Notice tone="info">{AVISO_COBRO_DE_CLIENTE}</Notice>
        </FormContainer>
      </ScrollView>
      {/* Acción primaria fija abajo; el aviso de qué falta y el error quedan arriba, a la vista del botón (frame 12). */}
      <PieFijo conInsetInferior>
        {aviso || registrar.error ? (
          <View testID="pie-avisos" style={{ gap: space[2] }}>
            {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
            {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el movimiento.')}</Notice> : null}
          </View>
        ) : null}
        <Button label="Registrar movimiento" loading={registrar.isPending} disabled={registrar.isPending || !puedeRegistrar} onPress={enviar} />
        {!puedeRegistrar ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA}</MotivoDeshabilitado> : null}
      </PieFijo>
    </View>
  )
}

/** Movimiento registrado (frame 13, como "Venta guardada"): ícono grande, título y explicación; "Volver" en el pie. */
function MovimientoRegistrado({ onVolver }: { onVolver: () => void }) {
  const c = useColors()
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4], paddingTop: space[12], alignItems: 'center', gap: space[3] }}>
        <View
          testID="listo-icono"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 96, height: 96, borderRadius: radii.pastilla, alignItems: 'center', justifyContent: 'center', backgroundColor: c.chip.entregado.bg }}
        >
          <Check size={40} color={c.chip.entregado.text} strokeWidth={2.5} />
        </View>
        <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text, textAlign: 'center' }}>Movimiento registrado</Text>
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>Los saldos de las cuentas ya están actualizados.</Text>
      </ScrollView>
      <PieFijo conInsetInferior>
        <Button label="Volver" onPress={onVolver} />
      </PieFijo>
    </View>
  )
}

/** "Te quedan $ X en la caja", o el aviso si la cuenta queda en negativo. */
function SaldoQueQueda({ saldo, cuenta }: { saldo: SaldoRestante; cuenta: string }) {
  const importe = formatImporte(saldo.saldoRestante, { moneda: saldo.moneda })
  return saldo.saldoRestante < 0
    ? <Notice tone="peligro">{`${cuenta} queda en ${importe}.`}</Notice>
    : <Notice tone="exito">{`Te quedan ${importe} en ${cuenta}.`}</Notice>
}

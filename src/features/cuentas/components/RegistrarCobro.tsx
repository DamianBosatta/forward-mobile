import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { mostrarNumero } from '@/core/utils/numero'
import { Button, Field, FormContainer, Notice, PieFijo, Progress, TopBar, TotalsRow, formatImporte, formatPorcentaje } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { useEstadoCuentaSocio } from '../api/queries'
import { useMediosDeCobro } from '../api/cobros'
import type { FormCobro } from '../lib/cobro'
import { formCobroVacio as formVacio } from '../lib/lineasCobro'
import { useEnvioDelCobro } from '../hooks/useEnvioDelCobro'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { usePermissions } from '@/core/auth/RequirePermission'
import { subirFotoCheque } from '../api/fotos'
import { CajaDelCobroInline } from './CajaDelCobroInline'
import { CobroListo } from './CobroListo'
import { DestinoDelCobro } from './DestinoDelCobro'
import { ElegirChip } from './ElegirChip'
import { ElegirComprobantes } from './ElegirComprobantes'
import { FotoDelCobro } from './FotoDelCobro'
import { OtrosMediosDelCobro } from './OtrosMediosDelCobro'
import { condicionesDelMedio } from '../lib/condicionesMedio'

export const AVISO_IMPUTACION =
  'Imputación automática: el servidor lo aplica a la deuda más vieja y te dice en qué cuenta (TST o Normal) quedó.'

const IMPUTACION = [{ id: 'automatica', label: 'Automática' }, { id: 'manual', label: 'Elegir comprobantes' }]

/**
 * Registrar un cobro (láminas ResCobro, TabCobro y CobroListo). La cuenta TST / Normal la elige el servidor.
 * En tablet horizontal van dos columnas: qué se cobra (imputación) a la izquierda y cómo pagó a la derecha.
 */
export function RegistrarCobro({ socioId, onVolver, conBarra = false, medioInicial }: { socioId: string; onVolver: () => void; conBarra?: boolean; medioInicial?: 'cheque' }) {
  const c = useColors()
  const { isTabletLandscape } = useResponsive()
  const socio = useSocio(socioId)
  const estado = useEstadoCuentaSocio(socioId, !!socio.data?.puedeVerCuentaCorriente)
  const medios = useMediosDeCobro()
  const [f, setF] = useState<FormCobro>(formVacio)
  // La clave de idempotencia, la caja del depósito de la sesión y el POST: los mismos que el cobro en pasos (ver useEnvioDelCobro).
  const { registrar, cajaDelCobro, conCaja, sinCajaUtil, aviso, cobro, enviar: enviarCobro, reiniciar } = useEnvioDelCobro(socioId, f)
  const [subiendo, setSubiendo] = useState(false)
  // Objetivo del cobro: solo una guía visual de cuánto falta; no entra al payload (ni a la clave de idempotencia).
  const [objetivo, setObjetivo] = useState<'vencido' | 'saldo' | null>(null)
  const { hasCapability, canDo } = usePermissions()
  // POST Media/upload-cheque: quien cobra (MOD_PAGOS:Create) o quien gestiona cheques (MediaController).
  const subeFotoCheque = canDo('MOD_PAGOS', 'create') || hasCapability('CAP_GESTIONAR_CHEQUES')
  // Tesorería > "Cargar un cheque": el cobro abre con el medio Cheque ya elegido (una sola vez, el usuario puede cambiarlo).
  const medioInicialAplicado = useRef(false)
  useEffect(() => {
    if (medioInicial !== 'cheque' || medioInicialAplicado.current || !medios.data) return
    const m = medios.data.find(x => x.activo && x.id && x.esCheque)
    if (!m) return
    medioInicialAplicado.current = true
    setF(p => ({ ...p, medioPagoId: m.id!, esCheque: true, requiereCaja: !!m.requiereCaja }))
  }, [medioInicial, medios.data])
  const cheque = (campo: keyof FormCobro['cheque']) => (v: string) => setF(p => ({ ...p, cheque: { ...p.cheque, [campo]: v } }))

  if (socio.isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (!socio.data) return <Notice tone="peligro">{mensajeDelServidor(socio.error, 'No se pudo abrir el cliente.')}</Notice>
  const cliente = socio.data
  const medio = medios.data?.find(m => m.id === f.medioPagoId)
  const monto = leerNumero(f.monto)
  // Solo informativo: lo que se manda al servidor es el monto cargado, no el neto.
  const condiciones = condicionesDelMedio(medio, monto)
  const otros = f.otrosMedios.reduce((s, o) => s + Math.max(leerNumero(o.monto) ?? 0, 0), 0)
  // Lo que se cobra en total: el primer medio más los que se combinan.
  const total = (monto ?? 0) + otros
  const nombreMedio = (id: string | null) => medios.data?.find(m => m.id === id)?.nombre ?? ''

  if (cobro) {
    return (
      <CobroListo
        cliente={cliente}
        cobro={cobro}
        monto={total}
        medio={[f.medioPagoId, ...f.otrosMedios.map(o => o.medioPagoId)].map(nombreMedio).filter(Boolean).join(' + ')}
        lineas={[{ medioPagoId: f.medioPagoId, monto: f.monto }, ...f.otrosMedios].flatMap(l => {
          const m = leerNumero(l.monto)
          return l.medioPagoId && m ? [{ medio: nombreMedio(l.medioPagoId), monto: m }] : []
        })}
        imputacionManual={!!f.imputaciones}
        onVolver={onVolver}
        onOtro={() => { reiniciar(); setF(formVacio()) }}
      />
    )
  }

  const enviar = () => enviarCobro(subiendo)

  const deudaVencida = estado.data?.deudaVencida ?? 0

  const saldoActual = estado.data?.saldoActual ?? 0
  const meta = objetivo === 'vencido' ? deudaVencida : objetivo === 'saldo' ? saldoActual : 0
  const falta = Math.max(meta - total, 0)
  const ocupado = registrar.isPending || subiendo
  const fijarObjetivo = (o: 'vencido' | 'saldo') => {
    setObjetivo(o)
    // Solo carga el monto del primer medio (la meta menos lo que ya llevan los otros): el cobro se arma y
    // se manda igual, con lo que quede en los campos. Mientras se manda, el monto queda fijo.
    const m = o === 'vencido' ? deudaVencida : saldoActual
    setF(p => ({ ...p, monto: mostrarNumero(Math.max(m - otros, 0)) }))
  }

  const encabezado = (
    <>
      {/* Con barra, la dirección y el saldo van en el subtítulo de la barra (lámina cuentas-cobro). */}
      {!conBarra ? (
        <View style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccionDeEntrega(cliente)}</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombreDelCliente(cliente)}</Text>
        </View>
      ) : null}
      {estado.data && !conBarra ? <TotalsRow label="Saldo del cliente" importe={estado.data.saldoActual} /> : null}
      <View style={{ gap: space[3], backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, padding: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
          <View accessible accessibilityLabel={`Cobrás: ${formatImporte(total)}`}>
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Cobrás</Text>
            <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(total)}</Text>
          </View>
          {objetivo ? (
            <View accessible accessibilityLabel={falta > 0 ? `Falta: ${formatImporte(falta)}` : 'Cubre el objetivo'} style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{falta > 0 ? 'Falta' : 'Cubierto'}</Text>
              <Text style={[typeScale.cuerpoDestacado, importe, { color: falta > 0 ? c.chip.pendiente.text : c.chip.entregado.text }]}>{formatImporte(falta)}</Text>
            </View>
          ) : deudaVencida > 0 ? (
            // Sin objetivo elegido la tira ya dice cuánto hay vencido: es de donde sale "Todo lo vencido".
            <View accessible accessibilityLabel={`Vencido: ${formatImporte(deudaVencida)}`} style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Vencido</Text>
              <Text style={[typeScale.cuerpoDestacado, importe, { color: c.chip.pendiente.text }]}>{formatImporte(deudaVencida)}</Text>
            </View>
          ) : null}
        </View>
        {objetivo && meta > 0 ? <Progress value={Math.min(total, meta)} max={meta} accessibilityLabel={`Cobrado ${formatImporte(total)} de ${formatImporte(meta)}`} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {deudaVencida > 0 ? <Button label="Todo lo vencido" variant={objetivo === 'vencido' ? 'primario' : 'secundario'} disabled={ocupado} onPress={() => fijarObjetivo('vencido')} /> : null}
          {saldoActual > 0 ? <Button label="Saldo total" variant={objetivo === 'saldo' ? 'primario' : 'secundario'} disabled={ocupado} onPress={() => fijarObjetivo('saldo')} /> : null}
          {deudaVencida > 0 || saldoActual > 0 ? <Button label="Otro monto" variant="secundario" disabled={ocupado} onPress={() => setObjetivo(null)} /> : null}
        </View>
      </View>
    </>
  )

  const imputacion = (
    <>
      <ElegirChip
        titulo="Se aplica a"
        opciones={IMPUTACION}
        valor={f.imputaciones ? 'manual' : 'automatica'}
        onCambio={id => setF(p => ({ ...p, imputaciones: id === 'manual' ? (p.imputaciones ?? {}) : null }))}
      />
      {f.imputaciones ? (
        <ElegirComprobantes socioId={socioId} valor={f.imputaciones} onCambio={v => setF(p => ({ ...p, imputaciones: v }))} />
      ) : (
        <Notice tone="info">{AVISO_IMPUTACION}</Notice>
      )}
    </>
  )

  const pago = (
    <>
      <Field label="Monto" value={f.monto} onChangeText={v => setF(p => ({ ...p, monto: v }))} keyboardType="decimal-pad" alignRight />
        {medios.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
        <ElegirChip
          titulo="Medio"
          opciones={(medios.data ?? []).filter(m => m.activo && m.id).map(m => ({ id: m.id!, label: m.nombre ?? '' }))}
          valor={f.medioPagoId}
          onCambio={id => setF(p => ({ ...p, medioPagoId: id, cuentaPropiaId: null, esCheque: !!medios.data?.find(m => m.id === id)?.esCheque, requiereCaja: !!medios.data?.find(m => m.id === id)?.requiereCaja }))}
        />
        {conCaja ? <CajaDelCobroInline caja={cajaDelCobro} /> : null}
        {medios.error ? <Notice tone="peligro">{mensajeDelServidor(medios.error, 'No se pudieron cargar los medios de pago.')}</Notice> : null}
        {condiciones ? (
          <View
            accessible
            accessibilityLabel={`Condiciones del medio: Comisión ${formatPorcentaje(condiciones.comisionPorcentaje)}${condiciones.comision != null ? ` ${formatImporte(condiciones.comision)}` : ''}`}
            style={{ gap: space[1] }}
          >
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
              {`Comisión ${formatPorcentaje(condiciones.comisionPorcentaje)}${condiciones.comision != null ? ` · ${formatImporte(condiciones.comision)}` : ''}`}
            </Text>
            {condiciones.neto != null ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Neto ${formatImporte(condiciones.neto)}`}</Text> : null}
            {condiciones.diasAcreditacion > 0 ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Se acredita en ${condiciones.diasAcreditacion} ${condiciones.diasAcreditacion === 1 ? 'día' : 'días'}`}</Text>
            ) : null}
          </View>
        ) : null}

        {f.esCheque ? (
          <>
            <Notice tone="info">El cheque se carga en un cobro de un solo medio.</Notice>
            <Field label="N.º de cheque" value={f.cheque.numero} onChangeText={cheque('numero')} />
            <Field label="Banco" value={f.cheque.banco} onChangeText={cheque('banco')} />
            <Field label="Titular" value={f.cheque.titular} onChangeText={cheque('titular')} />
            <Field label="Fecha de emisión" value={f.cheque.emision} onChangeText={cheque('emision')} help="dd/mm/aaaa" />
            <Field label="Fecha de pago" value={f.cheque.pago} onChangeText={cheque('pago')} help="dd/mm/aaaa" />
            {subeFotoCheque ? (
              <FotoDelCobro que="del cheque" url={f.chequeFotoUrl} subir={subirFotoCheque} onUrl={u => setF(p => ({ ...p, chequeFotoUrl: u }))} onSubiendo={setSubiendo} />
            ) : null}
          </>
        ) : null}
        {medio && !f.requiereCaja && !f.esCheque ? (
          <DestinoDelCobro
            medio={medio}
            cuentaPropiaId={f.cuentaPropiaId}
            comprobanteUrl={f.comprobanteUrl}
            onCuenta={id => setF(p => ({ ...p, cuentaPropiaId: id }))}
            onComprobante={u => setF(p => ({ ...p, comprobanteUrl: u }))}
            onSubiendo={setSubiendo}
          />
        ) : null}

        <OtrosMediosDelCobro
          medios={medios.data ?? []}
          valor={f.otrosMedios}
          onCambio={otrosMedios => setF(p => ({ ...p, otrosMedios }))}
          disabled={registrar.isPending || subiendo}
        />

        <Field label="Referencia (opcional)" value={f.referencia} onChangeText={v => setF(p => ({ ...p, referencia: v }))} help="Por ejemplo, el N.º de operación" />
    </>
  )

  const avisos = (
    <>
        {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
        {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el cobro.')}</Notice> : null}
    </>
  )

  const pie = (
    <PieFijo>
      <Button label={total > 0 ? `Registrar cobro de ${formatImporte(total)}` : 'Registrar cobro'} loading={registrar.isPending} disabled={registrar.isPending || sinCajaUtil || subiendo} onPress={enviar} />
    </PieFijo>
  )

  return (
    <View style={{ flex: 1 }}>
      {conBarra ? <TopBar lineasMultiples title="Cobrar" subtitle={estado.data ? `${direccionDeEntrega(cliente)} · Saldo ${formatImporte(estado.data.saldoActual)}` : direccionDeEntrega(cliente)} leading={{ kind: 'atras', onPress: onVolver }} /> : null}
      <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        <FormContainer style={{ gap: space[4] }}>
          {encabezado}
          {isTabletLandscape ? (
            <View style={{ flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0, gap: space[4] }}>
                <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>¿Qué cobrás?</Text>
                {imputacion}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: space[4] }}>
                <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>¿Cómo te pagó?</Text>
                {pago}
              </View>
            </View>
          ) : (
            <>
              {pago}
              {imputacion}
            </>
          )}
          {avisos}
        </FormContainer>
      </ScrollView>
      {pie}
    </View>
  )
}

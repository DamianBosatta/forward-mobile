import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { mostrarNumero } from '@/src/utils/numero'
import { Button, Field, FormContainer, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { diaArgentina } from '@/src/utils/date'
import { useEstadoCuentaSocio } from '../api/queries'
import { claveDeOtroSocio, useCajasAbiertas, useMediosDeCobro, useRegistrarCobro, type CobroRegistrado } from '../api/cobros'
import { armarCobro, entraACaja, mostrarFecha, type FormCobro } from '../lib/cobro'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { nuevaClaveIdempotencia } from '@/features/venta-nueva/lib/payload'
import { usePermissions } from '@/core/auth/RequirePermission'
import { subirFotoCheque } from '../api/fotos'
import { CobroListo } from './CobroListo'
import { DestinoDelCobro } from './DestinoDelCobro'
import { ElegirChip } from './ElegirChip'
import { ElegirComprobantes } from './ElegirComprobantes'
import { FotoDelCobro } from './FotoDelCobro'
import { OtrosMediosDelCobro } from './OtrosMediosDelCobro'

export const AVISO_IMPUTACION =
  'Imputación automática: el servidor lo aplica a la deuda más vieja y te dice en qué cuenta (TST o Normal) quedó.'

const hoy = () => mostrarFecha(diaArgentina(Date.now()))
const formVacio = (): FormCobro => ({
  monto: '',
  medioPagoId: null,
  esCheque: false,
  requiereCaja: false,
  depositoId: null,
  referencia: '',
  cheque: { numero: '', banco: '', titular: '', emision: hoy(), pago: hoy() },
  cuentaPropiaId: null,
  comprobanteUrl: null,
  chequeFotoUrl: null,
  imputaciones: null,
  otrosMedios: [],
})

const IMPUTACION = [{ id: 'automatica', label: 'Automática' }, { id: 'manual', label: 'Elegir comprobantes' }]

/**
 * Registrar un cobro (láminas ResCobro, TabCobro y CobroListo). La cuenta TST / Normal la elige el servidor.
 * En tablet horizontal van dos columnas: qué se cobra (imputación) a la izquierda y cómo pagó a la derecha.
 */
export function RegistrarCobro({ socioId, onVolver }: { socioId: string; onVolver: () => void }) {
  const c = useColors()
  const { isTabletLandscape } = useResponsive()
  const socio = useSocio(socioId)
  const estado = useEstadoCuentaSocio(socioId, !!socio.data?.puedeVerCuentaCorriente)
  const medios = useMediosDeCobro()
  const registrar = useRegistrarCobro()
  const [f, setF] = useState<FormCobro>(formVacio)
  // Una clave por cobro, la misma en cada reintento (tocar de nuevo tras un corte no lo carga dos veces);
  // «Registrar otro cobro» arranca otra. Un cobro duplicado es peor que perder una edición: se edite lo que se
  // edite del formulario (monto, medio, cheque, referencia) la clave NO cambia, y si el cobro anterior sí se había
  // grabado el servidor lo dice con un 409 y lo nuevo no se guarda. Solo se cambia si el servidor dice que la
  // clave era de otro socio.
  const [clave, setClave] = useState(nuevaClaveIdempotencia)
  // Con el cobro combinado, cualquiera de las líneas puede ser efectivo.
  const conCaja = entraACaja(f)
  const cajas = useCajasAbiertas(conCaja)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cobro, setCobro] = useState<CobroRegistrado | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const { hasCapability, canDo } = usePermissions()
  // POST Media/upload-cheque: quien cobra (MOD_PAGOS:Create) o quien gestiona cheques (MediaController).
  const subeFotoCheque = canDo('MOD_PAGOS', 'create') || hasCapability('CAP_GESTIONAR_CHEQUES')
  const cheque = (campo: keyof FormCobro['cheque']) => (v: string) => setF(p => ({ ...p, cheque: { ...p.cheque, [campo]: v } }))

  if (socio.isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (!socio.data) return <Notice tone="peligro">{mensajeDelServidor(socio.error, 'No se pudo abrir el cliente.')}</Notice>
  const cliente = socio.data
  const medio = medios.data?.find(m => m.id === f.medioPagoId)
  const monto = leerNumero(f.monto)
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
        onOtro={() => { setCobro(null); setF(formVacio()); setClave(nuevaClaveIdempotencia()); registrar.reset() }}
      />
    )
  }

  // Con caja: sin lista cargada, con error (aunque haya datos viejos) o sin ninguna abierta, no se cobra.
  const sinCajas = conCaja && !!cajas.data && !cajas.error && cajas.data.length === 0
  const sinCajaUtil = conCaja && (!cajas.data || !!cajas.error || cajas.data.length === 0)

  const enviar = () => {
    if (registrar.isPending || subiendo) return
    // Con caja, sin las cajas abiertas no se sabe en cuál entra el efectivo: no se manda incompleto.
    if (sinCajaUtil) return
    // Con una sola caja abierta se manda esa; con varias, la elige quien cobra.
    const abiertas = cajas.data ?? []
    const depositoId = f.depositoId ?? (abiertas.length === 1 ? abiertas[0].depositoId : null)
    if (conCaja && abiertas.length > 1 && !depositoId) return setAviso('Elegí en qué caja entra el efectivo.')
    const r = armarCobro(socioId, { ...f, depositoId }, clave)
    if ('error' in r) return setAviso(r.error)
    setAviso(null)
    registrar.mutate(r.payload, {
      onSuccess: setCobro,
      onError: e => { if (claveDeOtroSocio(e)) setClave(nuevaClaveIdempotencia()) },
    })
  }

  const deudaVencida = estado.data?.deudaVencida ?? 0

  const encabezado = (
    <>
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccionDeEntrega(cliente)}</Text>
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombreDelCliente(cliente)}</Text>
      </View>
      {estado.data ? <TotalsRow label="Saldo del cliente" importe={estado.data.saldoActual} /> : null}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4] }}
      >
        <View accessible accessibilityLabel={`Cobrás: ${formatImporte(total)}`}>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Cobrás</Text>
          <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(total)}</Text>
        </View>
        {deudaVencida > 0 ? (
          // Solo carga el monto del primer medio (lo vencido menos lo que ya llevan los otros): el cobro se arma y
          // se manda igual, con lo que quede en los campos. Mientras se manda, el monto queda fijo.
          <Button label="Todo lo vencido" variant="secundario" disabled={registrar.isPending || subiendo} onPress={() => setF(p => ({ ...p, monto: mostrarNumero(Math.max(deudaVencida - otros, 0)) }))} />
        ) : null}
      </View>
    </>
  )

  const imputacion = (
    <>
      <ElegirChip
        titulo="Imputación"
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
        {conCaja && (cajas.data?.length ?? 0) > 1 ? (
          <ElegirChip
            titulo="Caja"
            opciones={(cajas.data ?? []).map(k => ({ id: k.depositoId, label: k.depositoNombre ?? 'Caja' }))}
            valor={f.depositoId}
            onCambio={id => setF(p => ({ ...p, depositoId: id }))}
          />
        ) : null}
        {conCaja && cajas.error ? (
          <>
            <Notice tone="peligro">{mensajeDelServidor(cajas.error, 'No se pudieron cargar las cajas abiertas.')}</Notice>
            <Button label="Reintentar" variant="secundario" onPress={() => { void cajas.refetch() }} />
          </>
        ) : null}
        {sinCajas ? <Notice tone="advertencia">No hay ninguna caja abierta. Abrí una caja para registrar cobros en efectivo.</Notice> : null}
        {conCaja && cajas.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
        {medios.error ? <Notice tone="peligro">{mensajeDelServidor(medios.error, 'No se pudieron cargar los medios de pago.')}</Notice> : null}

        {f.esCheque ? (
          <>
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
    <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
      <Button label={total > 0 ? `Registrar cobro de ${formatImporte(total)}` : 'Registrar cobro'} loading={registrar.isPending} disabled={registrar.isPending || sinCajaUtil || subiendo} onPress={enviar} />
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4] }}>
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

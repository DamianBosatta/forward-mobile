import React, { useState } from 'react'
import { Alert, Linking, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CreditCard, FileText, MessageCircle, type LucideIcon } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { getNotaEntregaUrl, getVentaPdfUrl, useAnularVenta, useConvertirPresupuesto } from '@/libs/api-client/ventas'
import type { VentaDetalleDto } from '@/libs/api-client/types'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { codigoDeVenta, tipoDeVenta } from '@/features/venta-nueva/lib/ventaGuardada'
import { useReabrirPresupuesto } from '../hooks/useReabrirPresupuesto'
import { DIAS_VIGENCIA_PRESUPUESTO, type AccionesDeVenta as Acciones } from '../lib/accionesVenta'
import { mensajeWhatsAppVenta, urlWhatsAppVenta } from '../lib/whatsappVenta'
import { AnularVentaSheet } from './AnularVentaSheet'

interface Props {
  venta: VentaDetalleDto
  acciones: Acciones
  /** Al terminar de anular (el panel de la tablet se cierra; en teléfono se vuelve a la lista). */
  onAnulada: () => void
}

const MSG_CONVERTIR = '¿Convertir este presupuesto en pedido? Se reserva el stock y, si algún precio quedó por debajo del mínimo, va a necesitar autorización.'

/**
 * Lo que se hace con la venta: pasar el presupuesto a pedido (o reabrirlo si venció), editar y anular con motivo.
 * Qué se ve y qué queda deshabilitado lo decide `accionesDeVenta` (reglas de la web); acá solo se muestra.
 */
export function AccionesDeVenta({ venta, acciones, onAnulada }: Props) {
  const h = venta.venta
  const router = useRouter()
  const userId = useAuthStore((s) => s.user?.id) ?? ''
  const convertir = useConvertirPresupuesto()
  const reabrir = useReabrirPresupuesto()
  const anular = useAnularVenta()
  const [hoja, setHoja] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esPresupuesto = h.tipoOperacion === 1

  const aPedido = () => Alert.alert('Pasar a pedido', MSG_CONVERTIR, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Pasar a pedido',
      onPress: () => void convertir.mutateAsync({ id: h.id, version: h.version, usuarioGeneradorId: userId }).then(
        () => Alert.alert('Listo', 'El presupuesto pasó a pedido. Si algo necesita autorización, queda por autorizar.'),
        (e) => Alert.alert('No se pudo pasar a pedido', mensajeDelServidor(e)),
      ),
    },
  ])

  const confirmarAnular = async (motivo: string) => {
    setError(null)
    try {
      await anular.mutateAsync({ id: h.id, version: h.version, motivoAnulacion: motivo })
      setHoja(false)
      onAnulada()
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo anular.'))
    }
  }

  const { anular: a } = acciones
  return (
    <View style={{ gap: space[3] }}>
      {acciones.pasarAPedido ? <Button label="Pasar a pedido" loading={convertir.isPending} onPress={aPedido} /> : null}
      {acciones.reabrir ? (
        <Button label="Reabrir" loading={reabrir.isPending} onPress={() => void reabrir.mutateAsync(h.id).catch((e) => Alert.alert('No se pudo reabrir', mensajeDelServidor(e)))} />
      ) : null}
      {acciones.editar ? <Button label="Editar" variant="secundario" onPress={() => router.push(`/(tabs)/ventas/nueva-v2?editar=${h.id}` as never)} /> : null}
      {a.visible ? <Button label="Anular" variant="secundario" disabled={!a.habilitado} onPress={() => { setError(null); setHoja(true) }} /> : null}
      {a.visible && !a.habilitado && a.motivo ? <MotivoDeshabilitado>{a.motivo}</MotivoDeshabilitado> : null}
      <AnularVentaSheet
        visible={hoja}
        esPresupuesto={esPresupuesto}
        cargando={anular.isPending}
        error={error}
        onClose={() => setHoja(false)}
        onConfirmar={(m) => void confirmarAnular(m)}
      />
    </View>
  )
}

function Celda({ icono: Icono, label, onPress, principal, cargando, deshabilitado }: { icono: LucideIcon; label: string; onPress: () => void; principal?: boolean; cargando?: boolean; deshabilitado?: boolean }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!cargando, disabled: !!deshabilitado }}
      onPress={cargando || deshabilitado ? undefined : onPress}
      style={{
        flex: 1, height: 56, borderRadius: radii.campo + 2, alignItems: 'center', justifyContent: 'center', gap: 2,
        borderWidth: 1, borderColor: principal ? c.action : c.border, backgroundColor: principal ? c.action : c.surface, opacity: deshabilitado ? 0.5 : 1,
      }}
    >
      <Icono size={20} color={principal ? c.onAction : c.text} />
      <Text style={{ ...typeScale.secundario, fontWeight: '700', color: principal ? c.onAction : c.text }}>{label}</Text>
    </Pressable>
  )
}

interface BarraProps {
  venta: VentaDetalleDto
  acciones: Acciones
  /** `saldoPendiente > 0` del servidor: como la web, sin saldo no se ofrece cobrar. */
  conSaldo: boolean
  onCobrar: () => void
}

/** Barra de abajo (ResVentaDetalle): WhatsApp, PDF y Cobrar. El teléfono sin número válido deja WhatsApp sin enlace. */
export function BarraDeLaVenta({ venta, acciones, conSaldo, onCobrar }: BarraProps) {
  const c = useColors()
  const h = venta.venta
  const [pdf, setPdf] = useState(false)
  const url = urlWhatsAppVenta(h.clienteTelefono, mensajeWhatsAppVenta({ tipoOperacion: h.tipoOperacion, id: h.id, codigoPedido: h.codigoPedido, total: formatImporte(h.totalAmount, { moneda: h.totalCurrency }) }))

  const compartir = async () => {
    setPdf(true)
    const nombre = `${tipoDeVenta(h).toUpperCase()}-${codigoDeVenta(h)}.pdf`
    let r = await sharePdf(getVentaPdfUrl(h.id), nombre)
    // Un servidor anterior no tiene el PDF comercial (404): se comparte la Nota de Entrega, como antes.
    if (!r.ok && r.status === 404) r = await sharePdf(getNotaEntregaUrl(h.id), nombre)
    setPdf(false)
    if (!r.ok) Alert.alert('No se pudo compartir el PDF', r.message)
  }

  return (
    <View style={{ flexDirection: 'row', gap: space[2], padding: space[3], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
      <Celda icono={MessageCircle} label="WhatsApp" deshabilitado={!url} onPress={() => url && void Linking.openURL(url)} />
      <Celda icono={FileText} label="PDF" cargando={pdf} onPress={() => void compartir()} />
      {acciones.cobrar && conSaldo ? <Celda icono={CreditCard} label="Cobrar" principal onPress={onCobrar} /> : null}
    </View>
  )
}

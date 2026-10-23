import React, { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, Segmented } from '@/core/ui/fw'
import { api } from '@/core/api/client'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { getNotaEntregaUrl, getVentaPdfUrl, useAnularVenta, useConvertirPresupuesto } from '@/libs/api-client/ventas'
import type { VentaDetalleDto } from '@/libs/api-client/types'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { diaArgentina } from '@/src/utils/date'
import { motivosAutorizacion } from '../lib/motivosAutorizacion'
import { esEstadoVenta } from '@/core/constants/estados'
import { codigoDeVenta, tipoDeVenta } from '../lib/ventaGuardada'

const DIA_MS = 86_400_000
const CUANDO = [
  { value: '1', label: 'Mañana' },
  { value: '3', label: 'En 3 días' },
  { value: '7', label: 'En una semana' },
] as const
type Cuando = (typeof CUANDO)[number]['value']

interface Props {
  venta: VentaDetalleDto
  /** "Dirección · nombre" del cliente, para el título del recordatorio. */
  rotulo: string
}

/**
 * Lo que se hace con una venta guardada (plan 9 §2.1, PR 2.9; láminas Guardada y DetalleVenta):
 * compartir el PDF, convertir un presupuesto en pedido, agendar y anular con motivo. Cada acción
 * la decide el servidor; el teléfono muestra lo que responde.
 */
export function AccionesVenta({ venta, rotulo }: Props) {
  const c = useColors()
  const h = venta.venta
  const { canDo } = usePermissions()
  const userId = useAuthStore((s) => s.user?.id) ?? ''
  const convertir = useConvertirPresupuesto()
  const anular = useAnularVenta()
  const [pdf, setPdf] = useState(false)
  const [hoja, setHoja] = useState<'anular' | 'agendar' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [titulo, setTitulo] = useState('')
  const [cuando, setCuando] = useState<Cuando>('1')
  const [agendando, setAgendando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esPresupuestoPendiente = h.tipoOperacion === 1 && esEstadoVenta(h.estado, 'Pendiente')
  const puedeConvertir = esPresupuestoPendiente && canDo('MOD_VENTAS', 'update')
  const puedeAnular = canDo('MOD_VENTAS', 'delete') && !esEstadoVenta(h.estado, 'Anulada', 'EnRuta')
  // UpdateVentaCommandHandler: solo se editan ventas Pendiente o Confirmada.
  const puedeEditar = canDo('MOD_VENTAS', 'update') && esEstadoVenta(h.estado, 'Pendiente', 'Confirmada')
  const puedeDuplicar = canDo('MOD_VENTAS', 'create')
  const router = useRouter()
  const ir = (param: 'editar' | 'duplicar') => router.push(`/(tabs)/ventas/nueva-v2?${param}=${h.id}` as never)

  const compartir = async () => {
    setPdf(true)
    const nombre = `${tipoDeVenta(h).toUpperCase()}-${codigoDeVenta(h)}.pdf`
    let r = await sharePdf(getVentaPdfUrl(h.id), nombre)
    // Un servidor anterior no tiene el PDF comercial (404): se comparte la Nota de Entrega, como antes.
    if (!r.ok && r.status === 404) r = await sharePdf(getNotaEntregaUrl(h.id), nombre)
    setPdf(false)
    if (!r.ok) Alert.alert('No se pudo compartir el PDF', r.message)
  }

  const aPedido = () => Alert.alert('¿Convertir en pedido?', 'Pasa a pedido y reserva stock. Si algo necesita autorización, queda por autorizar.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Convertir',
      onPress: () => void convertir.mutateAsync({ id: h.id, version: h.version, usuarioGeneradorId: userId }).then(async () => {
        const d = await api.get<VentaDetalleDto>(`/api/v1/Ventas/${h.id}`).catch(() => null)
        const motivos = motivosAutorizacion(d?.venta.motivoPendienteAutorizacion)
        if (esEstadoVenta(d?.venta.estado, 'PendienteAutorizacion')) {
          Alert.alert('Quedó por autorizar', motivos.length ? `Porque ${motivos.join(', ')}. Te avisamos cuando lo resuelvan.` : 'Te avisamos cuando lo resuelvan.')
        } else Alert.alert('Ahora es un pedido', 'El presupuesto pasó a pedido.')
      }, (e) => Alert.alert('No se pudo convertir', mensajeDelServidor(e))),
    },
  ])

  const confirmarAnular = async () => {
    setError(null)
    try {
      await anular.mutateAsync({ id: h.id, version: h.version, motivoAnulacion: motivo.trim() })
      setHoja(null)
      Alert.alert('Venta anulada', `${tipoDeVenta(h)} ${codigoDeVenta(h)} quedó anulado.`)
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo anular la venta.'))
    }
  }

  const agendar = async () => {
    setError(null)
    setAgendando(true)
    try {
      await api.post('/api/v1/Calendario/eventos', {
        tipo: 'Manual', titulo: titulo.trim(), fechaInicio: diaArgentina(Date.now() + Number(cuando) * DIA_MS),
        socioComercialId: h.clienteId, avisarDiasAntes: 0, visibilidad: 'Personal',
      })
      setHoja(null)
      Alert.alert('Agendado', 'Quedó en tu calendario.')
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo agendar.'))
    } finally {
      setAgendando(false)
    }
  }

  const abrir = (cual: 'anular' | 'agendar') => {
    setError(null)
    // El rótulo se arma al abrir: el cliente (por dirección) puede llegar después que la venta.
    if (cual === 'agendar') setTitulo(`${tipoDeVenta(h)} ${codigoDeVenta(h)} · ${rotulo}`)
    setHoja(cual)
  }

  return (
    <View style={{ gap: space[3] }}>
      {puedeConvertir ? <Button label="Convertir en pedido" loading={convertir.isPending} onPress={aPedido} /> : null}
      <Button label="Compartir PDF con el cliente" variant={puedeConvertir ? 'secundario' : 'primario'} loading={pdf} onPress={() => void compartir()} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {[
          puedeEditar && <Button key="e" label="Editar" variant="secundario" onPress={() => ir('editar')} />,
          puedeDuplicar && <Button key="d" label="Duplicar" variant="secundario" onPress={() => ir('duplicar')} />,
          <Button key="g" label="Agendar" variant="secundario" onPress={() => abrir('agendar')} />,
          puedeAnular && <Button key="a" label="Anular" variant="secundario" onPress={() => abrir('anular')} />,
        ].filter(Boolean).map((boton, i) => <View key={i} style={{ flexBasis: '45%', flexGrow: 1 }}>{boton}</View>)}
      </View>
      <BottomSheet visible={hoja === 'anular'} onClose={() => setHoja(null)} accessibilityLabel="Anular venta">
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{`Anular ${tipoDeVenta(h).toLowerCase()} ${codigoDeVenta(h)}`}</Text>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Ej.: el cliente lo canceló." multiline />
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Anular" variant="peligro" disabled={!motivo.trim()} loading={anular.isPending} onPress={() => void confirmarAnular()} />
      </BottomSheet>
      <BottomSheet visible={hoja === 'agendar'} onClose={() => setHoja(null)} accessibilityLabel="Agendar">
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Agendar</Text>
        <Field label="Recordatorio" value={titulo} onChangeText={setTitulo} />
        <Segmented accessibilityLabel="Cuándo" options={[...CUANDO]} value={cuando} onChange={setCuando} />
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Agendar" disabled={!titulo.trim()} loading={agendando} onPress={() => void agendar()} />
      </BottomSheet>
    </View>
  )
}

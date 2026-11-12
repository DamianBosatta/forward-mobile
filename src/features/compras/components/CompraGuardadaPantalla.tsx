import React, { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors, useSombraTarjeta } from '@/libs/theme'
import { Button, Notice, StatusChip, TopBar, chipForEstado, formatImporte, pesoSemibold } from '@/core/ui/fw'
import { useAsignarFotoFacturaCompra, useCompra, useConfirmarCompra, useGuardarComprobanteCompra, type CompraFaltante } from '@/libs/api-client/compras'
import { useSocio } from '@/libs/api-client/socios'
import { usePermissions } from '@/core/auth/RequirePermission'
import { inicioKeys } from '@/core/query/queryClient'
import { esEstadoCompra } from '@/core/constants/estados'
import { hoyTexto } from '@/core/utils/fecha'
import { mostrarNumero } from '@/core/utils/numero'
import { avisoCompraFaltante, type Aviso } from '../lib/confirmar-y-recibir'
import { mensajeDelServidor } from '../lib/mensaje-error'
import { numeroDeCompra } from '../lib/numero'
import { textoSuma, unidadesAIngresar } from '../lib/recepcion'
import { formDesdeComprobante, formNuevo, seCorrigeEnLaWeb } from '../lib/comprobante'
import { RecibirCompra } from './RecibirCompra'
import { ComprobanteProveedorPantalla, type ComprobanteCargado } from './ComprobanteProveedorPantalla'

interface Props {
  id: string
  /** Cómo terminó "Confirmar y recibir" (lo dejó la compra nueva en memoria). */
  aviso?: Aviso
}

/**
 * "Compra guardada" (maqueta "Compras como venta", frames 17 a 20; copia "Venta guardada"): qué quedó, para qué proveedor,
 * el resumen y qué hacer ahora. El estado sale de la compra que devuelve el servidor: nota de pedido (se puede confirmar),
 * confirmada (se puede recibir), recibida y recibida con faltante (cuando llegó una parte y lo que faltó pasó a otra compra).
 */
export function CompraGuardadaPantalla({ id, aviso }: Props) {
  const c = useColors()
  const sombra = useSombraTarjeta()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeModificar = usePermissions().canDo('MOD_COMPRAS', 'update')
  const q = useCompra(id)
  const socio = useSocio(q.data?.proveedorId ?? '')
  const confirmar = useConfirmarCompra()
  const guardarComprobante = useGuardarComprobanteCompra()
  const asignarFoto = useAsignarFotoFacturaCompra()
  const [recibiendo, setRecibiendo] = useState(false)
  const [faltante, setFaltante] = useState<CompraFaltante | null>(null)
  const [avisoVigente, setAvisoVigente] = useState<Aviso | null>(aviso ?? null)
  const [comprobanteAbierto, setComprobanteAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listo = () => router.replace('/(tabs)' as never)
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  // Recién guardada: el caché puede traer la versión de antes; se espera la que llega al abrir.
  const compra = q.isFetchedAfterMount && q.isSuccess ? q.data : undefined
  if (!compra) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Compra guardada" />
        <View style={{ padding: space[4], gap: space[3] }}>
          {q.isError ? <Notice tone="peligro">No se pudo traer la compra. Ya quedó guardada: la ves en la lista.</Notice> : <ActivityIndicator color={c.brand} />}
          {q.isError ? <Button label="Listo" onPress={() => router.replace('/(tabs)/compras' as never)} /> : null}
        </View>
      </View>
    )
  }

  if (recibiendo) {
    return (
      <RecibirCompra
        compra={compra}
        onVolver={() => setRecibiendo(false)}
        onHecho={(f, foto) => {
          setRecibiendo(false)
          setFaltante(f.compraFaltanteNumero ? f : null)
          setAvisoVigente(null)
          setError(foto ?? null)
          queryClient.invalidateQueries({ queryKey: inicioKeys.all })
        }}
        onConflicto={() => { void q.refetch() }}
      />
    )
  }

  const estado = String(compra.estado)
  const nota = esEstadoCompra(estado, 'NotaPedido')
  const porRecibir = esEstadoCompra(estado, 'Confirmado')
  const recibida = esEstadoCompra(estado, 'Entregado')
  const conFaltante = recibida && (faltante?.compraFaltanteNumero || compra.compraFaltanteNumero)
  const faltanteId = faltante?.compraFaltanteId ?? compra.compraFaltanteId ?? null
  const faltanteNumero = faltante?.compraFaltanteNumero ?? compra.compraFaltanteNumero ?? null
  const numero = numeroDeCompra(compra)
  const unidades = unidadesAIngresar(compra.detalles)
  const titulo = nota ? `Nota de pedido ${numero} guardada` : recibida ? `Compra ${numero} recibida` : porRecibir ? `Compra ${numero} confirmada` : `Compra ${numero}`
  const chip = conFaltante ? { estado: 'porAutorizar' as const, label: 'Recibida con faltante' }
    : nota ? { estado: 'pendiente' as const, label: 'Nota de pedido' }
    : chipForEstado('compra', compra.estado)
  const resumen = `${compra.detalles.length} ${compra.detalles.length === 1 ? 'producto' : 'productos'} · ${mostrarNumero(unidades)} ${unidades === 1 ? 'unidad' : 'unidades'}`
  const puedeComprobante = recibida && puedeModificar && !(compra.comprobante && seCorrigeEnLaWeb(compra.comprobante))

  const confirmarNota = async () => {
    setError(null)
    try {
      await confirmar.mutateAsync(compra.id)
      queryClient.invalidateQueries({ queryKey: inicioKeys.all })
    } catch (e) {
      setError(`No se confirmó la compra: ${mensajeDelServidor(e)}`)
    }
  }
  const guardar = async (cargado: ComprobanteCargado) => {
    setError(null)
    try {
      await guardarComprobante.mutateAsync({ id: compra.id, comprobante: cargado.comprobante })
      if (cargado.fotoUrl) await asignarFoto.mutateAsync({ id: compra.id, fotoUrl: cargado.fotoUrl })
      setComprobanteAbierto(false)
      setAvisoVigente({ clave: 'recibida', tono: 'exito', texto: 'Se guardó el comprobante del proveedor.' })
    } catch (e) {
      setError(`No se guardó el comprobante: ${mensajeDelServidor(e)}`)
    }
  }

  const fila = (k: string, v: React.ReactNode, ultima = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: c.border }}>
      <Text style={secundario}>{k}</Text>
      {v}
    </View>
  )
  const enlace = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{label}</Text>
    </Pressable>
  )
  const ver = (label: string, destino: string, variant: 'primario' | 'secundario' = 'primario') => (
    <Button label={label} variant={variant} onPress={() => router.push(destino as never)} />
  )

  return (
    <View testID="compra-guardada" style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Compra guardada" />
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[6], gap: space[4] }}>
        <View style={{ padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, ...sombra, gap: space[2] }}>
          <View style={{ alignItems: 'center', gap: space[1], paddingBottom: space[2] }}>
            <View style={{ width: 56, height: 56, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={30} color={c.onAction} strokeWidth={2.5} />
            </View>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, ...pesoSemibold, color: c.text, textAlign: 'center', marginTop: space[2] }}>{titulo}</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, textAlign: 'center' }}>{compra.razonSocialProveedor}</Text>
            {socio.data?.cuit ? <Text style={{ ...secundario, ...importe, textAlign: 'center' }}>{`CUIT ${socio.data.cuit}`}</Text> : null}
            <Text style={{ ...secundario, textAlign: 'center' }}>{resumen}</Text>
          </View>
          {fila('Estado', chip ? <StatusChip estado={chip.estado} label={chip.label} /> : <Text style={{ ...typeScale.cuerpo, color: c.text }}>{estado}</Text>)}
          {fila('Depósito', <Text style={{ ...typeScale.secundario, color: c.text }}>{compra.nombreDeposito}</Text>)}
          {fila('Total', <Text style={{ ...typeScale.titulo, ...importe, ...pesoSemibold, color: c.text }}>{formatImporte(compra.totalAmount)}</Text>, true)}
        </View>

        {error ? <Notice tone="peligro">{error}</Notice> : null}
        {conFaltante && faltanteNumero ? <Notice tone="exito">{avisoCompraFaltante(faltanteNumero).texto}</Notice>
          : recibida ? (
            <>
              <Notice tone={avisoVigente?.tono ?? 'exito'}>{avisoVigente?.texto ?? 'La compra quedó confirmada y recibida.'}</Notice>
              <Text style={secundario}>{textoSuma(unidades)}</Text>
            </>
          )
          : porRecibir ? (
            <>
              <Notice tone="exito">Quedó guardado.</Notice>
              <Text style={secundario}>Todavía no entró stock ni se generó la deuda con el proveedor: se hace al recibir la mercadería.</Text>
            </>
          )
          : nota ? <Notice tone="info">Todavía no es una compra: no ingresa stock ni genera deuda hasta que la confirmes.</Notice>
          : null}

        {porRecibir && puedeModificar ? <Button label="Recibir mercadería" onPress={() => { setError(null); setRecibiendo(true) }} /> : null}
        {ver(nota ? 'Ver la nota de pedido' : 'Ver la compra', `/(tabs)/compras/${compra.id}`, porRecibir && puedeModificar ? 'secundario' : 'primario')}
        {nota && puedeModificar && compra.detalles.length > 0 ? (
          <Button label="Confirmar compra" variant="secundario" loading={confirmar.isPending} onPress={() => { void confirmarNota() }} />
        ) : null}
        {conFaltante && faltanteId && faltanteNumero ? ver(`Ver la compra ${numeroDeCompra({ id: faltanteId, numero: faltanteNumero })}`, `/(tabs)/compras/${faltanteId}`, 'secundario') : null}
        {puedeComprobante && !conFaltante ? (
          <Button label={compra.comprobante ? 'Corregir el comprobante del proveedor' : 'Cargar el comprobante del proveedor'} variant="secundario" onPress={() => setComprobanteAbierto(true)} />
        ) : null}
        <Button label="Comprarle a otro proveedor" variant="secundario" onPress={() => router.replace('/(tabs)/compras/nueva' as never)} />
        {enlace('Volver a Compras', () => router.replace('/(tabs)/compras' as never))}
        {enlace('Listo', listo)}
      </ScrollView>
      <ComprobanteProveedorPantalla visible={comprobanteAbierto}
        form={compra.comprobante ? formDesdeComprobante(compra.comprobante) : formNuevo(socio.data ?? { razonSocial: compra.razonSocialProveedor }, hoyTexto())}
        fotoUrl={compra.fotoFacturaProveedorUrl ?? null} guardando={guardarComprobante.isPending || asignarFoto.isPending} error={error}
        onVolver={() => setComprobanteAbierto(false)} onGuardar={(cargado) => { void guardar(cargado) }} />
    </View>
  )
}

import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, FilePen, HandCoins, MapPin, MessageCircle, Pencil, Phone, ShoppingCart } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, Segmented, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useSocio } from '@/libs/api-client/socios'
import { useVentas } from '@/libs/api-client/ventas'
import { useEstadoCuentaSocio } from '@/features/cuentas/api/queries'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { usePermissions } from '@/core/auth/RequirePermission'
import { usePuedeCobrar } from '@/features/cuentas/lib/permiso'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { puedePedirCambio } from '@/features/socios/lib/camposSensibles'
import { formatToLocalTime } from '@/core/utils/fecha'
import { AVISO_DEUDA_VENCIDA, CreditoDelCliente } from './CreditoDelCliente'
import { SolicitudCambioSheet } from './SolicitudCambio'
import { HeroSaldo, SaldosPorCuenta } from './SaldoDelCliente'
import { Esqueletos, FICHA_CARGANDO, FILAS_CARGANDO } from './Esqueletos'
import { Accion, Dato } from '@/features/socios/components/PiezasDeFicha'
import { FilaBloqueada } from '@/features/socios/components/FilaBloqueada'
import { useVenderA } from '@/features/venta-nueva/hooks/useVenderA'
import { urlLlamar, urlWhatsApp } from '../lib/contacto'
import { direccionDeEntrega, nombreDelCliente, textoCondicionPago } from '../lib/cliente'

export const AVISO_CONDICION_PAGO = 'Solo la cambia quien puede autorizar ventas'

type Solapa = 'compras' | 'cuenta' | 'datos'

/**
 * Ficha de un cliente (láminas Ficha del cliente y TabClientes): dirección como título, nombre aparte,
 * acciones, resumen de la cuenta y tres solapas (Compras, Cuenta, Datos). Lo que la web decidió se respeta:
 * cuenta solo si el servidor la deja ver, Editar si el servidor dice que es de tu cartera, dirección,
 * razón social y CUIT solo por administrador (los demás piden el cambio).
 * Visual de la propuesta "Clientes como venta" (frames 5 a 12): hero de saldo, tarjetas sin borde y el pie de la venta.
 */
export const MOTIVO_SIN_COBRO = 'No tenés permiso para cobrar'

/** Tarjeta sin borde de la ficha (v2). */
function Tarjeta({ children, testID, sinRelleno = false }: { children: React.ReactNode; testID?: string; sinRelleno?: boolean }) {
  const c = useColors()
  return (
    <View testID={testID} style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, overflow: 'hidden', ...(sinRelleno ? {} : { padding: space[4], gap: space[3] }) }}>
      {children}
    </View>
  )
}

function Titulo({ children }: { children: string }) {
  const c = useColors()
  return <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{children}</Text>
}

/**
 * `conBarra`: en teléfono la ficha pone su propia barra superior (dirección y nombre en el título, lápiz de
 * editar); en el panel de la tablet la barra es la de la lista.
 */
export function FichaCliente({ id, conBarra = false }: { id: string; conBarra?: boolean }) {
  const c = useColors()
  const router = useRouter()
  const { canUpdate } = usePermissions()
  const puedeCobrarPagos = usePuedeCobrar()
  const venderA = useVenderA()
  const [pidiendoCambio, setPidiendoCambio] = useState(false)
  const [solapa, setSolapa] = useState<Solapa>('compras')
  const puedeAutorizar = useAuthStore(s => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  const esAdmin = useAuthStore(s => s.isAdmin())
  const { data: cliente, isLoading, error } = useSocio(id)
  const verCuenta = !!cliente?.puedeVerCuentaCorriente
  const cuenta = useEstadoCuentaSocio(id, verCuenta)
  const ventas = useVentas({ clienteId: id, pageSize: 3 }, { enabled: !!cliente })

  const barraSimple = conBarra ? <TopBar title="Cliente" leading={{ kind: 'atras', onPress: () => router.back() }} /> : null
  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {barraSimple}
        <View style={{ padding: space[4] }}>
          <Esqueletos bloques={FICHA_CARGANDO} />
        </View>
      </View>
    )
  }
  if (error || !cliente) {
    return (
      <View style={{ flex: 1 }}>
        {barraSimple}
        <View style={{ padding: space[4] }}>
          <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo abrir el cliente.')}</Notice>
        </View>
      </View>
    )
  }

  const direccion = direccionDeEntrega(cliente)
  const nombre = nombreDelCliente(cliente)
  const telefono = cliente.telefono?.trim()
  const whatsapp = urlWhatsApp(telefono)
  const ultimas = ventas.data?.items ?? []
  const puedeEditar = cliente.puedeEditar && canUpdate('MOD_CLIENTES')
  const estado = cuenta.data
  const vencido = estado?.tieneDeudaVencida === true && typeof estado.deudaVencida === 'number' ? estado.deudaVencida : null
  const disponible = typeof estado?.creditoDisponible === 'number' ? estado.creditoDisponible : null
  // La pantalla de cobro pide los medios y las cajas abiertas: MOD_PAGOS:Read además de Create.
  const puedeCobrar = verCuenta && puedeCobrarPagos
  const subtitulo = [nombre, cliente.localidad?.trim()].filter(Boolean).join(' · ')
  const tope = cliente.topeCredito != null && cliente.topeCredito > 0 ? cliente.topeCredito : null
  // Cobrar es siempre la acción primaria; Nueva venta, la secundaria (lámina clientes-ficha).
  const alVender = venderA ? () => router.push(venderA(id) as never) : null
  const alCobrar = () => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: id } })
  const solapas = [
    { value: 'compras' as const, label: 'Compras' },
    ...(verCuenta ? [{ value: 'cuenta' as const, label: 'Cuenta' }] : []),
    { value: 'datos' as const, label: 'Datos' },
  ]
  const vencidaConImporte = estado?.tieneDeudaVencida === true && typeof estado.deudaVencida === 'number'

  return (
    <View style={{ flex: 1 }}>
      {conBarra ? (
        <TopBar
          lineasMultiples
          title={direccion}
          subtitle={subtitulo || undefined}
          leading={{ kind: 'atras', onPress: () => router.back() }}
          actions={puedeEditar ? [{ icon: Pencil, accessibilityLabel: 'Editar', onPress: () => router.push({ pathname: '/(tabs)/socios/nuevo', params: { id } }) }] : []}
        />
      ) : null}
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        {!conBarra ? (
          <View style={{ gap: space[1] }}>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccion}</Text>
            {subtitulo ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{subtitulo}</Text> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {telefono ? <Accion sinBorde icono={Phone} label="Llamar" onPress={() => Linking.openURL(urlLlamar(telefono))} /> : null}
          {whatsapp ? <Accion sinBorde icono={MessageCircle} label="WhatsApp" onPress={() => Linking.openURL(whatsapp)} /> : null}
          {cliente.direccion?.trim() ? (
            <Accion
              sinBorde
              icono={MapPin}
              label="Cómo llegar"
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`)}
            />
          ) : null}
          {!conBarra && puedeEditar ? (
            <Accion sinBorde icono={Pencil} label="Editar" onPress={() => router.push({ pathname: '/(tabs)/socios/nuevo', params: { id } })} />
          ) : null}
        </View>

        {estado ? (
          <>
            <HeroSaldo
              saldo={estado.saldoActual}
              vencido={vencido}
              diasDeudaMasVieja={cliente.diasDeudaMasVieja}
              tope={tope}
              disponible={disponible}
              accessibilityLabel={`Saldo ${formatImporte(estado.saldoActual)}`}
            />
            <SaldosPorCuenta tst={estado.saldoTst} normal={estado.saldoNormal} />
          </>
        ) : null}

        <Segmented options={solapas} value={solapa} onChange={setSolapa} accessibilityLabel="Secciones de la ficha" />

        {solapa === 'compras' ? (
          <View style={{ gap: space[3] }}>
            <Titulo>Últimas ventas</Titulo>
            {ventas.isLoading ? <Esqueletos bloques={FILAS_CARGANDO} /> : null}
            {ventas.error ? <Notice tone="peligro">{mensajeDelServidor(ventas.error, 'No se pudieron cargar las ventas.')}</Notice> : null}
            {!ventas.isLoading && !ventas.error && ultimas.length === 0 ? (
              <Tarjeta>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Todavía no tiene ventas.</Text>
              </Tarjeta>
            ) : null}
            {ultimas.length > 0 ? (
              <Tarjeta testID="lista-ultimas-ventas" sinRelleno>
                {ultimas.map((v, i) => {
                  const chip = chipForEstado('venta', v.estado)
                  const tipo = v.tipoOperacion === 1 ? 'Presupuesto' : 'Pedido'
                  return (
                    <Pressable
                      key={v.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${v.codigoPedido ?? 'Venta'}, ${tipo}, ${formatImporte(v.totalAmount)}`}
                      onPress={() => router.push({ pathname: '/(tabs)/ventas/[id]', params: { id: v.id } })}
                      android_ripple={{ color: c.surface2 }}
                      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingLeft: space[4], paddingRight: space[3], borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.surface2 }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{v.codigoPedido ?? '—'}</Text>
                        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${formatToLocalTime(v.fecha, 'EEE d/M')} · ${tipo}`}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                        <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(v.totalAmount)}</Text>
                        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
                      </View>
                      <ChevronRight testID="venta-chevron" size={20} color={c.textSecondary} />
                    </Pressable>
                  )
                })}
              </Tarjeta>
            ) : null}
          </View>
        ) : null}

        {solapa === 'cuenta' && verCuenta ? (
          <View style={{ gap: space[3] }}>
            <Titulo>Cuenta corriente</Titulo>
            {cuenta.isLoading ? <Esqueletos bloques={FILAS_CARGANDO} /> : null}
            {cuenta.error ? <Notice tone="peligro">{mensajeDelServidor(cuenta.error, 'No se pudo cargar la cuenta.')}</Notice> : null}
            {estado ? (
              <>
                {/* Totales como los del carrito (frame 6): renglones chicos y el saldo como renglón final destacado. */}
                <Tarjeta testID="totales-cuenta">
                  {cliente.topeCredito != null ? <TotalsRow label="Tope de crédito" importe={cliente.topeCredito} /> : null}
                  <CreditoDelCliente estado={estado} sinAviso />
                  {estado.saldoAFavor > 0 ? <TotalsRow label="A favor" importe={estado.saldoAFavor} /> : null}
                  <TotalsRow label="Saldo" importe={estado.saldoActual} destacado />
                </Tarjeta>
                {vencidaConImporte ? <Notice tone="advertencia">{AVISO_DEUDA_VENCIDA}</Notice> : null}
              </>
            ) : null}
          </View>
        ) : null}

        {solapa === 'datos' ? (
          <Tarjeta>
            <Dato etiquetaChica etiqueta="Dirección de entrega" valor={cliente.direccion} />
            <Dato etiquetaChica etiqueta="Localidad" valor={cliente.localidad} />
            <Dato etiquetaChica etiqueta="Contacto" valor={cliente.nombreContacto} />
            <Dato etiquetaChica etiqueta="Teléfono" valor={cliente.telefono} />
            <Dato etiquetaChica etiqueta="Razón social" valor={cliente.razonSocial} />
            <Dato etiquetaChica etiqueta="CUIT" valor={cliente.cuit} />
            <Dato etiquetaChica etiqueta="Condición frente al IVA" valor={cliente.condicionIva} />
            <Dato etiquetaChica etiqueta="Email" valor={cliente.email} />
            {/* Solo con el servidor nuevo (forward-system #896): uno anterior no manda el nombre y no se muestra nada. */}
            <Dato etiquetaChica etiqueta="Vendedor" valor={cliente.vendedorResponsableNombre} />
            {/* La dirección, la razón social y el CUIT solo los cambia un administrador (regla de la web); el resto los pide. */}
            {puedePedirCambio(esAdmin, puedeEditar) ? (
              <Button label="Pedir cambio" variant="secundario" icon={FilePen} onPress={() => setPidiendoCambio(true)} />
            ) : null}
            <View style={{ borderTopWidth: 1, borderTopColor: c.border }} />
            {puedeAutorizar ? (
              <Dato etiquetaChica etiqueta="Condición de pago" valor={textoCondicionPago(cliente.condicionPago)} />
            ) : (
              <FilaBloqueada etiqueta="Condición de pago" valor={textoCondicionPago(cliente.condicionPago)} razon={AVISO_CONDICION_PAGO} />
            )}
          </Tarjeta>
        ) : null}
      </ScrollView>

      {alVender || verCuenta ? (
        <View style={{ padding: space[4], gap: space[2], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {alVender ? (
              <View style={{ flex: 1 }}>
                <Button label="Nueva venta" icon={ShoppingCart} variant="secundario" onPress={alVender} />
              </View>
            ) : null}
            {verCuenta ? (
              <View style={{ flex: 1 }}>
                <Button label="Cobrar" icon={HandCoins} variant="primario" disabled={!puedeCobrar} onPress={alCobrar} />
              </View>
            ) : null}
          </View>
          {verCuenta && !puedeCobrar ? <MotivoDeshabilitado>{MOTIVO_SIN_COBRO}</MotivoDeshabilitado> : null}
        </View>
      ) : null}

      <SolicitudCambioSheet visible={pidiendoCambio} cliente={cliente} onCerrar={() => setPidiendoCambio(false)} />
    </View>
  )
}

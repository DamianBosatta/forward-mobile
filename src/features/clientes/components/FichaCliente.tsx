import React, { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FilePen, Lock, MapPin, MessageCircle, Pencil, Phone } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, Segmented, StatusChip, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { useVentas } from '@/libs/api-client/ventas'
import { useEstadoCuentaSocio } from '@/features/cuentas/api/queries'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { puedePedirCambio } from '@/features/socios/lib/camposSensibles'
import { formatToLocalTime } from '@/src/utils/date'
import { CreditoDelCliente } from './CreditoDelCliente'
import { SolicitudCambio } from './SolicitudCambio'
import { Accion, Cifra, Dato, Seccion } from '@/features/socios/components/PiezasDeFicha'
import { urlLlamar, urlWhatsApp } from '../lib/contacto'
import { direccionDeEntrega, nombreDelCliente, textoCondicionPago } from '../lib/cliente'

export const AVISO_CONDICION_PAGO = 'Solo la cambia quien puede autorizar ventas'

type Solapa = 'compras' | 'cuenta' | 'datos'

/**
 * Ficha de un cliente (láminas Ficha del cliente y TabClientes): dirección como título, nombre aparte,
 * acciones, resumen de la cuenta y tres solapas (Compras, Cuenta, Datos). Lo que la web decidió se respeta:
 * cuenta solo si el servidor la deja ver, Editar si el servidor dice que es de tu cartera, dirección,
 * razón social y CUIT solo por administrador (los demás piden el cambio).
 */
export function FichaCliente({ id }: { id: string }) {
  const c = useColors()
  const router = useRouter()
  const { canUpdate, canCreate, canRead } = usePermissions()
  const [pidiendoCambio, setPidiendoCambio] = useState(false)
  const [solapa, setSolapa] = useState<Solapa>('compras')
  const puedeAutorizar = useAuthStore(s => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  const esAdmin = useAuthStore(s => s.isAdmin())
  const { data: cliente, isLoading, error } = useSocio(id)
  const verCuenta = !!cliente?.puedeVerCuentaCorriente
  const cuenta = useEstadoCuentaSocio(id, verCuenta)
  const ventas = useVentas({ clienteId: id, pageSize: 3 }, { enabled: !!cliente })

  if (isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (error || !cliente) {
    return (
      <View style={{ padding: space[4] }}>
        <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo abrir el cliente.')}</Notice>
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
  const puedeCobrar = verCuenta && canCreate('MOD_PAGOS') && canRead('MOD_PAGOS')
  const subtitulo = [cliente.localidad?.trim(), cliente.cuit?.trim() ? `CUIT ${cliente.cuit.trim()}` : null].filter(Boolean).join(' · ')
  const solapas = [
    { value: 'compras' as const, label: 'Compras' },
    ...(verCuenta ? [{ value: 'cuenta' as const, label: 'Cuenta' }] : []),
    { value: 'datos' as const, label: 'Datos' },
  ]

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <View style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccion}</Text>
          {nombre ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombre}</Text> : null}
          {subtitulo ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{subtitulo}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {telefono ? <Accion icono={Phone} label="Llamar" onPress={() => Linking.openURL(urlLlamar(telefono))} /> : null}
          {whatsapp ? <Accion icono={MessageCircle} label="WhatsApp" onPress={() => Linking.openURL(whatsapp)} /> : null}
          {cliente.direccion?.trim() ? (
            <Accion
              icono={MapPin}
              label="Cómo llegar"
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`)}
            />
          ) : null}
          {puedeEditar ? (
            <Accion icono={Pencil} label="Editar" onPress={() => router.push({ pathname: '/(tabs)/socios/nuevo', params: { id } })} />
          ) : null}
          {/* La dirección, la razón social y el CUIT solo los cambia un administrador (regla de la web); el resto los pide. */}
          {puedePedirCambio(esAdmin, puedeEditar) ? <Accion icono={FilePen} label="Pedir cambio" onPress={() => setPidiendoCambio(true)} /> : null}
        </View>

        {pidiendoCambio ? <SolicitudCambio cliente={cliente} onCerrar={() => setPidiendoCambio(false)} /> : null}

        {estado ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Cifra etiqueta="Saldo" valor={formatImporte(estado.saldoActual)} />
            {vencido !== null ? <Cifra etiqueta="Vencido" valor={formatImporte(vencido)} alerta /> : null}
            {disponible !== null ? (
              <Cifra
                etiqueta={disponible < 0 ? 'Pasado del tope' : 'Crédito libre'}
                valor={formatImporte(Math.abs(disponible))}
                alerta={disponible < 0}
              />
            ) : null}
          </View>
        ) : null}

        <Segmented options={solapas} value={solapa} onChange={setSolapa} accessibilityLabel="Secciones de la ficha" />

        {solapa === 'compras' ? (
          <Seccion titulo="Últimas ventas">
            {ventas.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
            {ventas.error ? <Notice tone="peligro">{mensajeDelServidor(ventas.error, 'No se pudieron cargar las ventas.')}</Notice> : null}
            {!ventas.isLoading && !ventas.error && ultimas.length === 0 ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Todavía no tiene ventas.</Text>
            ) : null}
            {ultimas.map(v => {
              const chip = chipForEstado('venta', v.estado)
              const tipo = v.tipoOperacion === 1 ? 'Presupuesto' : 'Pedido'
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.codigoPedido ?? 'Venta'}, ${tipo}, ${formatImporte(v.totalAmount)}`}
                  onPress={() => router.push({ pathname: '/(tabs)/ventas/[id]', params: { id: v.id } })}
                  style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3] }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{v.codigoPedido ?? '—'}</Text>
                    <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${formatToLocalTime(v.fecha, 'EEE d MMM')} · ${tipo}`}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                    <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(v.totalAmount)}</Text>
                    {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
                  </View>
                </Pressable>
              )
            })}
          </Seccion>
        ) : null}

        {solapa === 'cuenta' && verCuenta ? (
          <Seccion titulo="Cuenta corriente">
            {cuenta.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
            {cuenta.error ? <Notice tone="peligro">{mensajeDelServidor(cuenta.error, 'No se pudo cargar la cuenta.')}</Notice> : null}
            {estado ? (
              <>
                <TotalsRow label="Saldo" importe={estado.saldoActual} destacado />
                {estado.saldoAFavor > 0 ? <TotalsRow label="A favor" importe={estado.saldoAFavor} /> : null}
                {cliente.topeCredito != null ? <TotalsRow label="Tope de crédito" importe={cliente.topeCredito} /> : null}
                <CreditoDelCliente estado={estado} />
              </>
            ) : null}
          </Seccion>
        ) : null}

        {solapa === 'datos' ? (
          <Seccion>
            <Dato etiqueta="Dirección de entrega" valor={cliente.direccion} />
            <Dato etiqueta="Localidad" valor={cliente.localidad} />
            <Dato etiqueta="Contacto" valor={cliente.nombreContacto} />
            <Dato etiqueta="Teléfono" valor={cliente.telefono} />
            <Dato etiqueta="Razón social" valor={cliente.razonSocial} />
            <Dato etiqueta="CUIT" valor={cliente.cuit} />
            <Dato etiqueta="Condición frente al IVA" valor={cliente.condicionIva} />
            <Dato etiqueta="Email" valor={cliente.email} />
            {/* Solo con el servidor nuevo (forward-system #896): uno anterior no manda el nombre y no se muestra nada. */}
            <Dato etiqueta="Vendedor" valor={cliente.vendedorResponsableNombre} />
            <View style={{ gap: space[1] }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Condición de pago</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                {!puedeAutorizar ? <Lock size={16} color={c.textSecondary} /> : null}
                <Text style={{ ...typeScale.cuerpo, color: c.text }}>{textoCondicionPago(cliente.condicionPago)}</Text>
              </View>
              {!puedeAutorizar ? (
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{AVISO_CONDICION_PAGO}</Text>
              ) : null}
            </View>
          </Seccion>
        ) : null}
      </ScrollView>

      {puedeCobrar ? (
        <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Registrar cobro" onPress={() => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: id } })} />
        </View>
      ) : null}
    </View>
  )
}

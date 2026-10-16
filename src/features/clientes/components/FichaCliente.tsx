import React, { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FilePen, Lock, MapPin, Pencil, Phone, type LucideIcon } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { useVentas } from '@/libs/api-client/ventas'
import { useEstadoCuentaSocio } from '@/features/cuentas/api/queries'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { formatToLocalTime } from '@/src/utils/date'
import { CreditoDelCliente } from './CreditoDelCliente'
import { SolicitudCambio } from './SolicitudCambio'
import { direccionDeEntrega, nombreDelCliente, textoCondicionPago } from '../lib/cliente'

export const AVISO_CONDICION_PAGO = 'Solo la cambia quien puede autorizar ventas'

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  const c = useColors()
  if (!valor?.trim()) return null
  return (
    <View style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{etiqueta}</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.text }}>{valor}</Text>
    </View>
  )
}

function Accion({ icono: Icono, label, onPress }: { icono: LucideIcon; label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 64,
        borderRadius: radii.campo,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[1],
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icono size={22} color={c.brandInk} />
      <Text style={{ ...typeScale.secundario, color: c.text }}>{label}</Text>
    </Pressable>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{titulo}</Text>
      {children}
    </View>
  )
}

/** Ficha de un cliente (lámina FichaCliente): dirección como título, nombre aparte, acciones, cuenta y datos. */
export function FichaCliente({ id }: { id: string }) {
  const c = useColors()
  const router = useRouter()
  const { canUpdate, isAdmin } = usePermissions()
  const [pidiendoCambio, setPidiendoCambio] = useState(false)
  const puedeAutorizar = useAuthStore(s => s.hasCapability('CAP_AUTORIZAR_VENTA'))
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
  const ultimas = ventas.data?.items ?? []
  const puedeEditar = cliente.puedeEditar && canUpdate('MOD_CLIENTES')

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccion}</Text>
        {nombre ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombre}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {telefono ? <Accion icono={Phone} label="Llamar" onPress={() => Linking.openURL(`tel:${telefono.replace(/[^\d+]/g, '')}`)} /> : null}
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
        {/* La dirección, la razón social y el CUIT solo los cambia un administrador; el resto los pide. */}
        {puedeEditar && !isAdmin() ? <Accion icono={FilePen} label="Pedir cambio" onPress={() => setPidiendoCambio(true)} /> : null}
      </View>

      {pidiendoCambio ? <SolicitudCambio cliente={cliente} onCerrar={() => setPidiendoCambio(false)} /> : null}

      {verCuenta ? (
        <Seccion titulo="Cuenta corriente">
          {cuenta.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
          {cuenta.error ? <Notice tone="peligro">{mensajeDelServidor(cuenta.error, 'No se pudo cargar la cuenta.')}</Notice> : null}
          {cuenta.data ? (
            <>
              <TotalsRow label="Saldo" importe={cuenta.data.saldoActual} destacado />
              {cuenta.data.saldoAFavor > 0 ? <TotalsRow label="A favor" importe={cuenta.data.saldoAFavor} /> : null}
              {cliente.topeCredito != null ? <TotalsRow label="Tope de crédito" importe={cliente.topeCredito} /> : null}
              <CreditoDelCliente estado={cuenta.data} />
            </>
          ) : null}
        </Seccion>
      ) : null}

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

      <Seccion titulo="Datos">
        <Dato etiqueta="Dirección de entrega" valor={cliente.direccion} />
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
    </ScrollView>
  )
}

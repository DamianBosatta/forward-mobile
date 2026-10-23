import React, { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FilePen, MessageCircle, Pencil, Phone } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip, chipForEstado, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { puedePedirCambio } from '@/features/socios/lib/camposSensibles'
import { Accion, Cifra, Dato, Seccion } from '@/features/socios/components/PiezasDeFicha'
import { SolicitudCambio } from '@/features/clientes/components/SolicitudCambio'
import { urlLlamar, urlWhatsApp } from '@/features/clientes/lib/contacto'
import { formatToLocalTime } from '@/src/utils/date'
import { useComprasDelProveedor } from '../hooks/useProveedores'
import { AVISO_FALTAN_DATOS, condicionBreve, saldoDelProveedor } from '../lib/proveedor'

/**
 * Ficha de un proveedor (láminas Ficha del proveedor y Tablet · Proveedores): razón social, CUIT y
 * cómo se le paga; llamar, WhatsApp y editar; lo que se le debe y sus últimas compras. Lo que la web
 * decidió se respeta: Editar con MOD_PROVEEDORES:update, razón social y CUIT solo por administrador
 * (los demás piden el cambio) y el saldo solo con MOD_CC:read.
 */
export function FichaProveedor({ id }: { id: string }) {
  const c = useColors()
  const router = useRouter()
  const { canUpdate, canRead } = usePermissions()
  const [pidiendoCambio, setPidiendoCambio] = useState(false)
  const esAdmin = useAuthStore(s => s.isAdmin())
  const { data: proveedor, isLoading, error } = useSocio(id)
  const compras = useComprasDelProveedor(id, !!proveedor)

  if (isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (error || !proveedor) {
    return (
      <View style={{ padding: space[4] }}>
        <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo abrir el proveedor.')}</Notice>
      </View>
    )
  }

  const telefono = proveedor.telefono?.trim()
  const whatsapp = urlWhatsApp(telefono)
  const puedeEditar = proveedor.puedeEditar && canUpdate('MOD_PROVEEDORES')
  const condicion = condicionBreve(proveedor.condicionPago)
  const faltan = proveedor.condicionesDeCompraFaltantes?.length > 0 || !condicion
  const saldo = proveedor.puedeVerSaldo && canRead('MOD_CC') ? saldoDelProveedor(proveedor.saldoAmount) : null
  const subtitulo = [proveedor.cuit?.trim() ? `CUIT ${proveedor.cuit.trim()}` : null, condicion ? `paga a ${condicion}` : null].filter(Boolean).join(' · ')
  const ultimas = compras.data?.items ?? []

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <View style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{proveedor.razonSocial}</Text>
          {subtitulo ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{subtitulo}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {telefono ? <Accion icono={Phone} label="Llamar" onPress={() => Linking.openURL(urlLlamar(telefono))} /> : null}
          {whatsapp ? <Accion icono={MessageCircle} label="WhatsApp" onPress={() => Linking.openURL(whatsapp)} /> : null}
          {puedeEditar ? (
            <Accion icono={Pencil} label="Editar" onPress={() => router.push({ pathname: '/(tabs)/proveedores/nuevo', params: { id } })} />
          ) : null}
          {/* La razón social y el CUIT solo los cambia un administrador (regla de la web); el resto los pide. */}
          {puedePedirCambio(esAdmin, puedeEditar) ? <Accion icono={FilePen} label="Pedir cambio" onPress={() => setPidiendoCambio(true)} /> : null}
        </View>

        {pidiendoCambio ? <SolicitudCambio cliente={proveedor} onCerrar={() => setPidiendoCambio(false)} /> : null}

        {faltan ? <Notice tone="info">{AVISO_FALTAN_DATOS}</Notice> : null}

        {saldo ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Cifra etiqueta={saldo.etiqueta} valor={formatImporte(saldo.monto)} />
          </View>
        ) : null}

        <Seccion titulo="Compras">
          {compras.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
          {compras.error ? <Notice tone="peligro">{mensajeDelServidor(compras.error, 'No se pudieron cargar las compras.')}</Notice> : null}
          {!compras.isLoading && !compras.error && ultimas.length === 0 ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Todavía no se le compró nada.</Text>
          ) : null}
          {ultimas.map(k => {
            const chip = chipForEstado('compra', k.estado)
            return (
              <Pressable
                key={k.id}
                accessibilityRole="button"
                accessibilityLabel={`Compra ${k.numero}, ${formatImporte(k.totalAmount)}`}
                onPress={() => router.push({ pathname: '/(tabs)/compras/[id]', params: { id: k.id } })}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3] }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`Compra ${k.numero}`}</Text>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{formatToLocalTime(k.fecha, 'EEE d MMM')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                  <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(k.totalAmount)}</Text>
                  {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
                </View>
              </Pressable>
            )
          })}
        </Seccion>

        <Seccion titulo="Datos">
          <Dato etiqueta="Razón social" valor={proveedor.razonSocial} />
          <Dato etiqueta="CUIT" valor={proveedor.cuit} />
          <Dato etiqueta="Condición frente al IVA" valor={proveedor.condicionIva} />
          <Dato etiqueta="Condición de pago" valor={condicion ? `Paga a ${condicion}` : null} />
          <Dato etiqueta="Teléfono" valor={proveedor.telefono} />
          <Dato etiqueta="Email" valor={proveedor.email} />
          <Dato etiqueta="Contacto" valor={proveedor.nombreContacto} />
          <Dato etiqueta="Dirección" valor={proveedor.direccion} />
          <Dato etiqueta="Localidad" valor={proveedor.localidad} />
        </Seccion>
      </ScrollView>
    </View>
  )
}

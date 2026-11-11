import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, FilePen, MapPin, MessageCircle, Pencil, Phone, Plus } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, Segmented, StatusChip, TopBar, chipForEstado, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { puedePedirCambio } from '@/features/socios/lib/camposSensibles'
import { Accion, Dato, Seccion, TituloDeSeccion } from '@/features/socios/components/PiezasDeFicha'
import { SolicitudCambioSheet } from '@/features/clientes/components/SolicitudCambio'
import { HeroSaldo } from '@/features/clientes/components/SaldoDelCliente'
import { Esqueletos, FICHA_CARGANDO, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { urlLlamar, urlWhatsApp } from '@/features/clientes/lib/contacto'
import { formatToLocalTime } from '@/core/utils/fecha'
import { useComprasDelProveedor } from '../hooks/useProveedores'
import { AVISO_FALTAN_DATOS, condicionBreve, horariosDeEntrega, saldoDelProveedor } from '../lib/proveedor'

type Solapa = 'compras' | 'condiciones' | 'datos'

const SOLAPAS: { value: Solapa; label: string }[] = [
  { value: 'compras', label: 'Compras' },
  { value: 'condiciones', label: 'Condiciones' },
  { value: 'datos', label: 'Datos' },
]

/**
 * Ficha de un proveedor (láminas proveedores-ficha y Tablet · Proveedores) con el estilo de la ficha del cliente
 * (propuesta "Clientes como venta", frames 5 a 12): razón social, CUIT y cómo se le paga; acciones sin borde; lo que
 * se le debe en el hero de saldo; tres solapas (Compras, Condiciones, Datos) y "Nueva compra" en el pie fijo.
 * Lo que la web decidió se respeta: Editar con MOD_PROVEEDORES:update, razón social y CUIT solo por administrador
 * (los demás piden el cambio) y el saldo solo con MOD_CC:read.
 *
 * `conBarra`: en teléfono la ficha pone su propia barra (razón social, CUIT y lápiz de editar); en el panel de la
 * tablet la barra es la de la lista y Editar va entre las acciones.
 */
export function FichaProveedor({ id, conBarra = false }: { id: string; conBarra?: boolean }) {
  const c = useColors()
  const router = useRouter()
  const { canUpdate, canRead, canCreate } = usePermissions()
  const [pidiendoCambio, setPidiendoCambio] = useState(false)
  const [solapa, setSolapa] = useState<Solapa>('compras')
  const esAdmin = useAuthStore(s => s.isAdmin())
  const { data: proveedor, isLoading, error } = useSocio(id)
  const compras = useComprasDelProveedor(id, !!proveedor)

  const barraSimple = conBarra ? <TopBar title="Proveedor" leading={{ kind: 'atras', onPress: () => router.back() }} /> : null
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
  if (error || !proveedor) {
    return (
      <View style={{ flex: 1 }}>
        {barraSimple}
        <View style={{ padding: space[4] }}>
          <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo abrir el proveedor.')}</Notice>
        </View>
      </View>
    )
  }

  const telefono = proveedor.telefono?.trim()
  const whatsapp = urlWhatsApp(telefono)
  const puedeEditar = proveedor.puedeEditar && canUpdate('MOD_PROVEEDORES')
  const condicion = condicionBreve(proveedor.condicionPago)
  const faltan = proveedor.condicionesDeCompraFaltantes?.length > 0 || !condicion
  const saldo = proveedor.puedeVerSaldo && canRead('MOD_CC') ? saldoDelProveedor(proveedor.saldoAmount) : null
  const cuit = proveedor.cuit?.trim() ? `CUIT ${proveedor.cuit.trim()}` : null
  const subtitulo = [cuit, condicion ? `paga a ${condicion}` : null].filter(Boolean).join(' · ')
  const ultimas = compras.data?.items ?? []
  const horarios = horariosDeEntrega(proveedor)
  // Mismo permiso que el "+" de la lista de compras (MOD_COMPRAS crear). La compra nueva arranca con este proveedor ya elegido.
  const alComprar = canCreate('MOD_COMPRAS') ? () => router.push({ pathname: '/(tabs)/compras/nueva', params: { proveedor: id } } as never) : null
  const alEditar = () => router.push({ pathname: '/(tabs)/proveedores/nuevo', params: { id } })

  return (
    <View style={{ flex: 1 }}>
      {conBarra ? (
        <TopBar
          lineasMultiples
          title={proveedor.razonSocial}
          subtitle={cuit ?? undefined}
          leading={{ kind: 'atras', onPress: () => router.back() }}
          actions={puedeEditar ? [{ icon: Pencil, accessibilityLabel: 'Editar', onPress: alEditar }] : []}
        />
      ) : null}
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        {!conBarra ? (
          <View style={{ gap: space[1] }}>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{proveedor.razonSocial}</Text>
            {subtitulo ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{subtitulo}</Text> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {telefono ? <Accion sinBorde icono={Phone} label="Llamar" onPress={() => Linking.openURL(urlLlamar(telefono))} /> : null}
          {whatsapp ? <Accion sinBorde icono={MessageCircle} label="WhatsApp" onPress={() => Linking.openURL(whatsapp)} /> : null}
          {proveedor.direccion?.trim() ? (
            <Accion
              sinBorde
              icono={MapPin}
              label="Cómo llegar"
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(proveedor.direccion)}`)}
            />
          ) : null}
          {!conBarra && puedeEditar ? <Accion sinBorde icono={Pencil} label="Editar" onPress={alEditar} /> : null}
        </View>

        {faltan ? <Notice tone="info">{AVISO_FALTAN_DATOS}</Notice> : null}

        {saldo ? (
          // TODO API: "N facturas sin pagar · la más vieja vence dd/mm" (hoy el servidor no manda la factura más vieja).
          <HeroSaldo
            etiqueta={saldo.etiqueta}
            saldo={saldo.monto}
            vencido={null}
            tope={null}
            disponible={null}
            accessibilityLabel={`${saldo.etiqueta} ${formatImporte(saldo.monto)}`}
          />
        ) : null}

        <Segmented options={SOLAPAS} value={solapa} onChange={setSolapa} accessibilityLabel="Secciones de la ficha" />

        {solapa === 'compras' ? (
          <View style={{ gap: space[3] }}>
            <TituloDeSeccion>Compras recientes</TituloDeSeccion>
            {compras.isLoading ? <Esqueletos bloques={FILAS_CARGANDO} /> : null}
            {compras.error ? <Notice tone="peligro">{mensajeDelServidor(compras.error, 'No se pudieron cargar las compras.')}</Notice> : null}
            {!compras.isLoading && !compras.error && ultimas.length === 0 ? (
              <Seccion>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Todavía no se le compró nada.</Text>
              </Seccion>
            ) : null}
            {ultimas.length > 0 ? (
              <Seccion testID="lista-compras-recientes" sinRelleno>
                {ultimas.map((k, i) => {
                  const chip = chipForEstado('compra', k.estado)
                  return (
                    <Pressable
                      key={k.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Compra ${k.numero}, ${formatImporte(k.totalAmount)}`}
                      onPress={() => router.push({ pathname: '/(tabs)/compras/[id]', params: { id: k.id } })}
                      android_ripple={{ color: c.surface2 }}
                      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingLeft: space[4], paddingRight: space[3], borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.surface2 }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`Compra ${k.numero}`}</Text>
                        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{formatToLocalTime(k.fecha, 'EEE d MMM')}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                        <Text style={[typeScale.titulo, importe, { fontWeight: '700', color: c.text }]}>{formatImporte(k.totalAmount)}</Text>
                        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
                      </View>
                      <ChevronRight testID="compra-chevron" size={20} color={c.textSecondary} />
                    </Pressable>
                  )
                })}
              </Seccion>
            ) : null}
          </View>
        ) : null}

        {solapa === 'condiciones' ? (
          <Seccion titulo="Condiciones de compra">
            <Fila etiqueta="Plazo de pago" valor={condicion ?? 'Sin cargar'} />
            <View style={{ borderTopWidth: 1, borderTopColor: c.surface2, paddingTop: space[3], gap: space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Horarios de entrega</Text>
                {/* El chip desaparece cuando el dato es real (D10). */}
                {horarios.confirmados ? null : <StatusChip estado="pendiente" label="A confirmar" />}
              </View>
              {horarios.tramos.map(t => <Fila key={t.dias} etiqueta={t.dias} valor={t.horario} />)}
              {horarios.tramos.length === 0 ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Todavía no hay horarios cargados.</Text> : null}
            </View>
          </Seccion>
        ) : null}

        {solapa === 'datos' ? (
          <Seccion>
            <Dato etiquetaChica etiqueta="Razón social" valor={proveedor.razonSocial} />
            <Dato etiquetaChica etiqueta="CUIT" valor={proveedor.cuit} />
            <Dato etiquetaChica etiqueta="Condición frente al IVA" valor={proveedor.condicionIva} />
            <Dato etiquetaChica etiqueta="Condición de pago" valor={condicion ? `Paga a ${condicion}` : null} />
            <Dato etiquetaChica etiqueta="Teléfono" valor={proveedor.telefono} />
            <Dato etiquetaChica etiqueta="Email" valor={proveedor.email} />
            <Dato etiquetaChica etiqueta="Contacto" valor={proveedor.nombreContacto} />
            <Dato etiquetaChica etiqueta="Dirección" valor={proveedor.direccion} />
            <Dato etiquetaChica etiqueta="Localidad" valor={proveedor.localidad} />
            {/* La razón social y el CUIT solo los cambia un administrador (regla de la web); el resto los pide. */}
            {puedePedirCambio(esAdmin, puedeEditar) ? (
              <Button label="Pedir cambio" variant="secundario" icon={FilePen} onPress={() => setPidiendoCambio(true)} />
            ) : null}
          </Seccion>
        ) : null}
      </ScrollView>

      {alComprar ? (
        // Pie fijo como el de la ficha del cliente, también en el panel de la tablet.
        <View testID="pie-ficha-proveedor" style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Nueva compra" icon={Plus} onPress={alComprar} />
        </View>
      ) : null}

      <SolicitudCambioSheet visible={pidiendoCambio} cliente={proveedor} onCerrar={() => setPidiendoCambio(false)} />
    </View>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] }}>
      <Text style={{ ...typeScale.cuerpo, color: c.text }}>{etiqueta}</Text>
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{valor}</Text>
    </View>
  )
}

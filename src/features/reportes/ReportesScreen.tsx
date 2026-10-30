import React, { useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { FONT, importe as cifras, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { BottomSheet, FormContainer, Notice, TopBar, TotalsRow, formatImporte, useMenuLeading } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { useResponsive } from '@/libs/useResponsive'
import { useResumenVendedor, type ResumenVendedor } from '@/libs/api-client/reportes'
import { useVendedores } from '@/libs/api-client/ventas'
import { useAhoraArgentina } from '@/src/utils/useAhoraArgentina'
import { mesDe, moverMes, nombreMes, tituloMes, type Mes } from './mes'
import { diaDeLaSemana, tituloSemana } from './semana'

type Vendedor = { id: string; nombre: string }

const semibold = { fontFamily: FONT.semibold, fontWeight: '600' as const }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const porcentaje = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} %`

/**
 * Reportes básicos (bloque 9, 5.4): las ventas del mes, las comisiones del mes y los cobros
 * pendientes de la cartera. El alcance lo decide el servidor; si es de gestión, ofrece el filtro
 * por vendedor.
 */
export function ReportesScreen() {
  const c = useColors()
  const { isTablet } = useResponsive()
  const menu = useMenuLeading()
  const ahora = useAhoraArgentina()
  const actual = mesDe(ahora)
  const anterior = moverMes(actual, -1)
  const [periodo, setPeriodo] = useState<'semana' | 'actual' | 'anterior'>('actual')
  const mes = periodo === 'actual' ? actual : anterior
  const [vendedor, setVendedor] = useState<Vendedor | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const q = useResumenVendedor(
    periodo === 'semana' ? { semana: diaDeLaSemana(ahora) } : { anio: mes.anio, mes: mes.mes },
    vendedor?.id ?? null,
  )
  const puedeElegir = q.data?.puedeElegirVendedor === true
  const vendedores = useVendedores(puedeElegir && eligiendo)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Lámina "Mis números": el período vive en las solapas de la barra superior. */}
      <TopBar
        title="Mis números"
        subtitle={periodo === 'semana' ? tituloSemana(ahora) : tituloMes(mes)}
        leading={menu}
        tabs={[
          { label: 'Semana', selected: periodo === 'semana', onPress: () => setPeriodo('semana') },
          { label: nombreMes(actual), selected: periodo === 'actual', onPress: () => setPeriodo('actual') },
          { label: nombreMes(anterior), selected: periodo === 'anterior', onPress: () => setPeriodo('anterior') },
        ]}
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} tintColor={c.brand} />}
        contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] }}>
        <FormContainer style={{ gap: space[3], ...(isTablet ? { maxWidth: 960 } : null) }}>
          {puedeElegir ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Vendedor: ${vendedor?.nombre ?? 'Todos'}`}
              accessibilityHint="Elegí de qué vendedor ver los reportes"
              onPress={() => setEligiendo(true)}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
            >
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Vendedor</Text>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, flex: 1 }} numberOfLines={1}>{vendedor?.nombre ?? 'Todos'}</Text>
              <ChevronDown size={20} color={c.textSecondary} />
            </Pressable>
          ) : null}
          {q.isLoading ? (
            <ActivityIndicator color={c.brand} accessibilityLabel="Cargando los reportes" />
          ) : q.isError && esFallaDeRed(q.error) ? (
            q.data ? (
              <>
                <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice>
                <Secciones r={q.data} />
              </>
            ) : (
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los reportes" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
            )
          ) : q.isError || !q.data ? (
            <Notice tone="peligro">No se pudieron cargar los reportes.</Notice>
          ) : (
            <Secciones r={q.data} />
          )}
          <Text style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>
            Reporte básico del vendedor. Los reportes de gestión se ven en la web.
          </Text>
        </FormContainer>
      </ScrollView>
      <BottomSheet visible={eligiendo} onClose={() => setEligiendo(false)} accessibilityLabel="Elegir vendedor">
        <View accessibilityRole="radiogroup" accessibilityLabel="Vendedor" style={{ gap: space[1] }}>
          {[{ id: '', nombre: 'Todos' }, ...(vendedores.data ?? [])].map((v) => {
            const activo = (vendedor?.id ?? '') === v.id
            return (
              <Pressable
                key={v.id || 'todos'}
                accessibilityRole="radio"
                accessibilityLabel={v.nombre}
                accessibilityState={{ checked: activo }}
                onPress={() => { setVendedor(v.id ? v : null); setEligiendo(false) }}
                style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.campo, backgroundColor: activo ? c.brandSoft : 'transparent' }}
              >
                <Text style={{ ...(activo ? typeScale.cuerpoDestacado : typeScale.cuerpo), color: activo ? c.brandInk : c.text }}>{v.nombre}</Text>
              </Pressable>
            )
          })}
          {vendedores.isLoading ? <ActivityIndicator color={c.brand} accessibilityLabel="Cargando vendedores" /> : null}
          {vendedores.isError ? <Notice tone="peligro">No se pudo cargar la lista de vendedores.</Notice> : null}
        </View>
      </BottomSheet>
    </View>
  )
}

function Tarjeta({ titulo, testID, children }: { titulo: string; testID: string; children: React.ReactNode }) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return (
    <View testID={testID} style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2], ...sombra }}>
      <Text accessibilityRole="header" style={{ ...typeScale.secundario, ...semibold, color: c.textSecondary }}>{titulo}</Text>
      {children}
    </View>
  )
}

/** Tarjeta de cifra de apoyo (Cobrado / Por cobrar): etiqueta, importe y una línea de apoyo. */
function Cifra({ etiqueta, importe, apoyo, testID }: { etiqueta: string; importe: number; apoyo?: string; testID: string }) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const monto = formatImporte(importe)
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[`${etiqueta}: ${monto}`, apoyo].filter(Boolean).join(', ')}
      style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[1], ...sombra }}
    >
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{etiqueta}</Text>
      <Text style={{ ...typeScale.titulo, color: c.text }}>{monto}</Text>
      {apoyo ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{apoyo}</Text> : null}
    </View>
  )
}

/** Franja oscura con lo que más importa: lo vendido, grande, con la cantidad y el ticket promedio. */
function FranjaVendido({ r }: { r: ResumenVendedor }) {
  const c = useColors()
  const { ventas } = r
  const monto = formatImporte(ventas.facturado)
  return (
    <View
      testID="reporte-ventas"
      accessible
      accessibilityLabel={`Vendido: ${monto}, ${plural(ventas.operaciones, 'venta', 'ventas')}`}
      style={{ backgroundColor: c.topBar, borderRadius: radii.tarjeta, padding: space[5], gap: space[1] }}
    >
      <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>Vendido</Text>
      <Text style={{ fontSize: 36, lineHeight: 44, ...semibold, color: c.onTopBarStrong, ...cifras }} adjustsFontSizeToFit numberOfLines={1}>{monto}</Text>
      <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>
        {`${plural(ventas.operaciones, 'venta', 'ventas')} · Ticket promedio ${formatImporte(ventas.ticketPromedio)}`}
      </Text>
      {/* Sin CAP_VER_COSTOS el servidor no lo manda: el margen revela el costo. */}
      {ventas.margenBrutoPorcentaje != null ? (
        <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>{`Margen bruto ${porcentaje(ventas.margenBrutoPorcentaje)}`}</Text>
      ) : null}
    </View>
  )
}

function Secciones({ r }: { r: ResumenVendedor }) {
  const c = useColors()
  const { ventas, comisiones, cobrosPendientes: cobros } = r
  return (
    <>
      <FranjaVendido r={r} />
      <View testID="reporte-cifras" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        <Cifra testID="cifra-cobrado" etiqueta="Cobrado" importe={ventas.cobrado} apoyo="de estas ventas" />
        <Cifra testID="cifra-por-cobrar" etiqueta="Por cobrar" importe={cobros.total} apoyo={plural(cobros.clientes, 'cliente con deuda', 'clientes con deuda')} />
      </View>
      <Tarjeta titulo="Mi cuenta de comisiones" testID="reporte-comisiones">
        <TotalsRow label="Generado" importe={comisiones.devengado} />
        {/* Con el signo menos escrito: la reversión resta. */}
        <TotalsRow label="Reversiones" importe={comisiones.reversiones ? -Math.abs(comisiones.reversiones) : comisiones.reversiones} />
        <TotalsRow label="Pagado" importe={comisiones.pagado} />
        <TotalsRow label="Neto del mes" importe={comisiones.neto} destacado />
        {/* El saldo de la cuenta es el de hoy, no el del mes. */}
        <TotalsRow label="A cobrar hoy" importe={comisiones.saldoActual} />
      </Tarjeta>
      <Tarjeta titulo="Clientes que te deben" testID="reporte-cobros">
        {cobros.clientes === 0 ? (
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Ningún cliente de la cartera debe.</Text>
        ) : (
          <>
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Total ${formatImporte(cobros.total)}`}</Text>
            {cobros.detalle.map((d) => (
              <View
                key={d.socioId}
                accessible
                accessibilityLabel={`${d.cliente}, debe ${formatImporte(d.deuda)}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: c.border }}
              >
                {/* El cliente se identifica por la dirección; la razón social va aparte. */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }} numberOfLines={2}>{d.cliente}</Text>
                  <Text style={{ ...typeScale.secundario, color: c.textSecondary }} numberOfLines={1}>{d.razonSocial}</Text>
                </View>
                <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, ...cifras }}>{formatImporte(d.deuda)}</Text>
              </View>
            ))}
            {cobros.clientes > cobros.detalle.length ? (
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
                {`Se muestran los ${cobros.detalle.length} que más deben.`}
              </Text>
            ) : null}
          </>
        )}
      </Tarjeta>
    </>
  )
}

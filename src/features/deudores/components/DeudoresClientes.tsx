import React, { useMemo, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native'
import { FileText } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, FilaDeSocio, Notice, formatImporte, useInsetInferior } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useVendedores } from '@/libs/api-client/ventas'
import { formatearCuit } from '@/libs/reglas/cuit'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { Esqueletos, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { useValorDiferido } from '@/features/clientes/hooks/useCartera'
import { ChipDeFiltro } from '@/features/autorizaciones/components/ChipDeFiltro'
import { ChipAntiguedadDeuda } from '@/features/cuentas/components/ChipAntiguedadDeuda'
import { chipAntiguedadDeuda } from '@/features/cuentas/lib/antiguedadDeuda'
import { useSinConexionSinDatos } from '@/features/ventas/lib/sinConexion'
import { useDeudores, type Deudor } from '../api/queries'
import { usePuedeExportarEstadoDeCuenta } from '../lib/permiso'
import { HojaEstadoDeCuenta } from './HojaEstadoDeCuenta'

type Vendedor = { id: string; nombre: string }

/**
 * Vista "Deudores" de Cuentas (S2, como la pestaña Deudas de la web): los clientes que deben, de mayor a menor deuda,
 * con su vendedor, buscador y filtro por vendedor (las opciones de `/ventas/vendedores`, que pide MOD_VENTAS:Read; un
 * vendedor ya ve solo sus clientes porque el servidor acota). Cada fila abre la cuenta del cliente y, con permiso del
 * export, lleva "Estado de cuenta" en PDF o Excel para compartir. Pedirla solo con MOD_PAGOS:Read.
 */
export function DeudoresClientes({ onAbrir }: { onAbrir: (socioId: string) => void }) {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const { canRead } = usePermissions()
  const veVendedores = canRead('MOD_VENTAS')
  const puedeExportar = usePuedeExportarEstadoDeCuenta()
  const [busqueda, setBusqueda] = useState('')
  const [vendedor, setVendedor] = useState<Vendedor | null>(null)
  const [eligiendoVendedor, setEligiendoVendedor] = useState(false)
  const [archivoDe, setArchivoDe] = useState<{ id: string; razonSocial: string } | null>(null)
  const texto = useValorDiferido(busqueda.trim())
  const q = useDeudores({ vendedorId: vendedor?.id, busqueda: texto || undefined }, true)
  const vendedores = useVendedores(veVendedores)
  const pausada = useSinConexionSinDatos(q)

  const filas = useMemo(() => (q.data?.pages ?? []).flatMap(p => p?.pagina?.items ?? []), [q.data])
  const primera = q.data?.pages?.[0]
  const total = primera?.deudaTotal
  const cantidad = primera?.pagina?.totalCount
  const sinRed = esFallaDeRed(q.error)
  const conFiltro = !!vendedor || !!texto

  return (
    <View style={{ flex: 1 }}>
      <BuscadorCartera sobre="pantalla" grande etiqueta="Buscar deudor" placeholder="Buscar razón social, fantasía o CUIT" valor={busqueda} onCambio={setBusqueda} />
      {veVendedores ? (
        <View style={{ flexDirection: 'row', paddingHorizontal: space[4], paddingBottom: space[1] }}>
          <ChipDeFiltro label={`Vendedor: ${vendedor?.nombre ?? 'Todos'}`} activo={!!vendedor} onPress={() => setEligiendoVendedor(true)} />
        </View>
      ) : null}
      {total !== undefined && cantidad !== undefined ? (
        <Text accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.text, paddingHorizontal: space[4], paddingTop: space[2] }}>
          {`${cantidad} ${cantidad === 1 ? 'cliente debe' : 'clientes deben'} `}
          <Text style={importe}>{formatImporte(total)}</Text>
        </Text>
      ) : null}
      {q.error && !(sinRed && filas.length === 0) ? (
        <View style={{ padding: space[4] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudieron cargar los deudores.')}</Notice>
          )}
        </View>
      ) : null}
      <FlatList
        testID="lista-deudores"
        data={filas}
        keyExtractor={item => item.socioId}
        renderItem={({ item }) => (
          <FilaDeDeudor
            deudor={item}
            onAbrir={item.puedeVerCuentaCorriente ? () => onAbrir(item.socioId) : undefined}
            onEstadoDeCuenta={puedeExportar && item.puedeVerCuentaCorriente ? () => setArchivoDe({ id: item.socioId, razonSocial: item.razonSocial }) : undefined}
          />
        )}
        contentContainerStyle={{ paddingTop: space[3], paddingBottom: space[6] + insetInferior }}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage() }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} tintColor={c.brandInk} />}
        ListEmptyComponent={
          pausada || (q.error && sinRed) ? (
            <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los deudores" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
          ) : q.isLoading ? (
            <View style={{ paddingHorizontal: space[4] }}>
              <Esqueletos bloques={FILAS_CARGANDO} />
            </View>
          ) : q.error ? undefined : (
            <EstadoDePantalla
              tipo="vacio"
              titulo={conFiltro ? 'No encontramos clientes con saldo pendiente para ese filtro.' : 'No hay clientes con saldo pendiente.'}
            />
          )
        }
      />
      {veVendedores ? (
        <ElegirVendedor
          visible={eligiendoVendedor}
          vendedores={vendedores.data ?? []}
          cargando={vendedores.isLoading}
          error={vendedores.isError}
          elegido={vendedor}
          onElegir={(v) => { setVendedor(v); setEligiendoVendedor(false) }}
          onClose={() => setEligiendoVendedor(false)}
        />
      ) : null}
      <HojaEstadoDeCuenta socio={archivoDe} onClose={() => setArchivoDe(null)} />
    </View>
  )
}

/** Un deudor por fila: razón social y monto, vendedor y CUIT, chip de antigüedad; el archivo como acción de 44 pt. */
function FilaDeDeudor({ deudor, onAbrir, onEstadoDeCuenta }: { deudor: Deudor; onAbrir?: () => void; onEstadoDeCuenta?: () => void }) {
  const c = useColors()
  const monto = formatImporte(deudor.saldoDeuda, { moneda: deudor.moneda })
  const vendedor = deudor.vendedorNombre ?? 'Sin vendedor'
  const cuit = formatearCuit(deudor.cuit)
  const antiguedad = chipAntiguedadDeuda(deudor.diasDeudaMasVieja)?.texto
  return (
    <FilaDeSocio
      titulo={deudor.razonSocial}
      lineasTitulo={2}
      derecha={<Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{monto}</Text>}
      linea2={[vendedor, cuit ? `CUIT ${cuit}` : null].filter(Boolean).join(' · ')}
      extra={<ChipAntiguedadDeuda dias={deudor.diasDeudaMasVieja} />}
      accion={onEstadoDeCuenta ? { icono: FileText, label: `Estado de cuenta de ${deudor.razonSocial}`, hint: 'PDF o Excel para compartir', onPress: onEstadoDeCuenta } : undefined}
      accessibilityLabel={[`${deudor.razonSocial}, debe ${monto}`, vendedor, antiguedad].filter(Boolean).join(', ')}
      onPress={onAbrir}
      chevron={!!onAbrir}
    />
  )
}

interface ElegirVendedorProps {
  visible: boolean
  vendedores: Vendedor[]
  cargando: boolean
  error: boolean
  elegido: Vendedor | null
  onElegir: (v: Vendedor | null) => void
  onClose: () => void
}

/** Hoja con los vendedores como opciones de 44 pt ("Todos" primero). */
function ElegirVendedor({ visible, vendedores, cargando, error, elegido, onElegir, onClose }: ElegirVendedorProps) {
  const c = useColors()
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Filtrar por vendedor">
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Vendedor</Text>
      <ScrollView style={{ maxHeight: 420 }}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Vendedor" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <ChipDeFiltro rol="radio" label="Todos" activo={elegido === null} onPress={() => onElegir(null)} />
          {vendedores.map(v => (
            <ChipDeFiltro key={v.id} rol="radio" label={v.nombre} activo={elegido?.id === v.id} onPress={() => onElegir(v)} />
          ))}
        </View>
      </ScrollView>
      {cargando ? <Text style={[typeScale.secundario, { color: c.textSecondary }]}>Cargando…</Text> : null}
      {error ? <Notice tone="peligro">No se pudo cargar la lista de vendedores.</Notice> : null}
      <Button label="Listo" variant="secundario" onPress={onClose} />
    </BottomSheet>
  )
}

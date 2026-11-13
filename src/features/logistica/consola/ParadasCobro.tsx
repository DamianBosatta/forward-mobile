import React, { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { HandCoins } from 'lucide-react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Button, StatusChip, formatImporte } from '@/core/ui/fw'
import { esFallaDeRed } from '@/core/api/errores'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { nuevaClaveIdempotencia } from '@/features/venta-nueva/lib/payload'
import { useCobrarParadaCobro, useNoCobrarParadaCobro } from '@/features/cobros/api'
import {
  MOTIVOS_NO_COBRO, PARADA_COBRO_COBRADA, PARADA_COBRO_NO_COBRADA, PARADA_COBRO_PENDIENTE,
  type MotivoNoCobro, type ParadaCobro,
} from '@/features/cobros/paradaCobro'
import { useMediosCobroChofer } from '@/libs/api-client/logistica'
import { encolarAccion } from '../cola/colaConsola'
import { useColaConsola } from '../cola/useColaConsola'
import { conAccionesCobroEnCola } from '../cola/conAccionesEnCola'
import { ParadaCobroPantalla, lineasParaEnviar, type ResultadoParadaCobro } from './ParadaCobroPantalla'
import { montoDeLinea, type LineaCobroForm } from './entrega'
import { invalidarPorCambioDeHojaDeRuta } from '@/libs/api-client/invalidaciones'

interface Props {
  hojaDeRutaId: string
  paradas: ParadaCobro[]
  /** Cuántas paradas de entrega tiene la ruta: las de solo cobro vienen después y siguen su numeración. */
  paradasDeEntrega: number
  /** Antes de iniciar el recorrido (o en solo lectura) se ven, pero no se reportan. */
  puedeReportar: boolean
}

const motivoTexto = (m: number | null | undefined, texto?: string | null) =>
  texto ?? MOTIVOS_NO_COBRO.find((x) => x.numero === m)?.texto ?? ''

/**
 * Paradas de solo cobro del itinerario (S9, S10), después de las entregas y con su propio aspecto: ícono de billetes y
 * chip "Solo cobro". Cobrar y "No cobré" usan la cola sin señal de la consola (misma FIFO), con la clave de idempotencia
 * del cobro guardada por parada: reintentar manda la misma clave. Una parada pendiente no frena el finalizar el viaje.
 */
export function ParadasCobro({ hojaDeRutaId, paradas, paradasDeEntrega, puedeReportar }: Props) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const qc = useQueryClient()
  const usuarioId = useAuthStore((s) => s.user?.id) ?? ''
  const { items } = useColaConsola()
  const cobrar = useCobrarParadaCobro()
  const noCobrar = useNoCobrarParadaCobro()
  // Los medios se piden apenas se ve la sección: así un cobro sin señal los encuentra ya guardados.
  useMediosCobroChofer(puedeReportar && paradas.length > 0)
  const claves = useRef(new Map<string, string>())
  const ocupada = useRef(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoParadaCobro | null>(null)

  if (paradas.length === 0) return null
  // Lo cobrado o cerrado sin señal ya cuenta como hecho aunque el servidor todavía no lo sepa.
  const lista = conAccionesCobroEnCola(paradas, items.filter((a) => a.hojaDeRutaId === hojaDeRutaId))
  const total = paradasDeEntrega + lista.length
  const seleccionada = lista.findIndex((p) => p.id === abierta)

  const claveDe = (id: string) => {
    const guardada = claves.current.get(id)
    if (guardada) return guardada
    const nueva = nuevaClaveIdempotencia()
    claves.current.set(id, nueva)
    return nueva
  }
  const cerrar = () => { setAbierta(null); setError(null); setResultado(null) }
  const abrir = (id: string) => { setError(null); setResultado(null); setAbierta(id) }

  const alCobrar = async (parada: ParadaCobro, form: LineaCobroForm[]) => {
    if (ocupada.current) return
    ocupada.current = true
    setError(null)
    const cuerpo = { claveIdempotencia: claveDe(parada.id), lineas: lineasParaEnviar(form) }
    const monto = form.reduce((t, l) => t + (montoDeLinea(l) ?? 0), 0)
    const guardar = () => {
      encolarAccion(usuarioId, {
        tipo: 'cobroParada', clave: cuerpo.claveIdempotencia, hojaDeRutaId, paradaId: parada.id, clienteNombre: parada.clienteNombre, cuerpo, cobrado: monto,
      })
      setResultado({ tipo: 'cobro', monto, guardada: true })
    }
    try {
      // Sin señal no se llama al servidor: queda en el teléfono con la misma clave y sale sola al volver.
      if (!onlineManager.isOnline()) { guardar(); return }
      await cobrar.mutateAsync({ hojaDeRutaId, paradaCobroId: parada.id, cuerpo })
      claves.current.delete(parada.id)
      setResultado({ tipo: 'cobro', monto, guardada: false })
    } catch (e) {
      if (esFallaDeRed(e)) { guardar(); return }
      const codigo = (e as { codigo?: string } | null)?.codigo
      // La clave ya quedó con otro cuerpo: el servidor guarda que una parada se resuelve una sola vez, así que una clave nueva es segura.
      // `Duplicado`: la misma clave corrió a la par en otra parada. Tampoco se reusa.
      if (codigo === 'ClaveIdempotenciaConOtroCuerpo' || codigo === 'Duplicado') claves.current.delete(parada.id)
      // El estado de la parada (y de la tarea) lo decide el servidor: se vuelve a leer, no se supone.
      if (codigo === 'ParadaYaReportada' || codigo === 'Duplicado') void invalidarPorCambioDeHojaDeRuta(qc, hojaDeRutaId)
      setError(mensajeDelServidor(e, 'No se pudo registrar el cobro.'))
    } finally {
      ocupada.current = false
    }
  }

  const alNoCobrar = async (parada: ParadaCobro, motivo: MotivoNoCobro) => {
    if (ocupada.current) return
    ocupada.current = true
    setError(null)
    const texto = MOTIVOS_NO_COBRO.find((x) => x.valor === motivo)?.texto ?? ''
    const guardar = () => {
      // El servidor no pide clave para esto (mismo motivo = 200): una sola acción por parada.
      encolarAccion(usuarioId, {
        tipo: 'noCobroParada', clave: `no-cobrada:${parada.id}`, hojaDeRutaId, paradaId: parada.id, clienteNombre: parada.clienteNombre, cuerpo: { motivo },
      })
      setResultado({ tipo: 'noCobrada', motivo: texto, guardada: true })
    }
    try {
      if (!onlineManager.isOnline()) { guardar(); return }
      await noCobrar.mutateAsync({ hojaDeRutaId, paradaCobroId: parada.id, cuerpo: { motivo } })
      setResultado({ tipo: 'noCobrada', motivo: texto, guardada: false })
    } catch (e) {
      if (esFallaDeRed(e)) { guardar(); return }
      setError(mensajeDelServidor(e, 'No se pudo cerrar la parada.'))
    } finally {
      ocupada.current = false
    }
  }

  return (
    <>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{`Solo cobro (${lista.length})`}</Text>
      <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, ...sombra }}>
        {lista.map((p, i) => (
          <FilaCobro
            key={p.id}
            parada={p}
            numero={paradasDeEntrega + i + 1}
            ultima={i === lista.length - 1}
            puedeCobrar={puedeReportar && p.estado === PARADA_COBRO_PENDIENTE}
            onCobrar={() => abrir(p.id)}
          />
        ))}
      </View>
      {seleccionada >= 0 ? (
        <ParadaCobroPantalla
          key={lista[seleccionada].id}
          parada={lista[seleccionada]}
          numero={paradasDeEntrega + seleccionada + 1}
          total={total}
          enviando={cobrar.isPending || noCobrar.isPending}
          error={error}
          resultado={resultado}
          onCerrar={cerrar}
          onCobrar={(form) => alCobrar(lista[seleccionada], form)}
          onNoCobre={(m) => alNoCobrar(lista[seleccionada], m)}
        />
      ) : null}
    </>
  )
}

function FilaCobro({ parada, numero, ultima, puedeCobrar, onCobrar }: { parada: ParadaCobro; numero: number; ultima: boolean; puedeCobrar: boolean; onCobrar: () => void }) {
  const c = useColors()
  const titulo = parada.direccion ?? parada.clienteNombre
  return (
    <View
      accessibilityLabel={`Parada ${numero} de solo cobro: ${titulo}`}
      style={{ gap: space[2], padding: space[4], borderBottomWidth: ultima ? 0 : 1, borderBottomColor: c.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <HandCoins size={24} color={c.brandInk} strokeWidth={2} />
        <View style={{ flex: 1, gap: space[1] }}>
          {/* La dirección es lo que el chofer busca; el nombre va aparte. */}
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`${numero} · ${titulo}`}</Text>
          {parada.direccion ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{parada.clienteNombre}</Text> : null}
        </View>
        {parada.estado === PARADA_COBRO_COBRADA ? <StatusChip estado="entregado" label="Cobrada" /> : null}
        {parada.estado === PARADA_COBRO_NO_COBRADA ? <StatusChip estado="porAutorizar" label="No cobrada" /> : null}
        {parada.estado === PARADA_COBRO_PENDIENTE ? <StatusChip estado="pendiente" label="Solo cobro" /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
        {parada.estado === PARADA_COBRO_COBRADA ? (
          // Sin permiso para ver importes el monto llega null: se lee como cobrada, sin importe ni deuda.
          parada.montoCobrado != null
            ? <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{`Cobrado ${formatImporte(parada.montoCobrado)}`}</Text>
            : <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Cobrado</Text>
        ) : parada.estado === PARADA_COBRO_NO_COBRADA ? (
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{motivoTexto(parada.motivoNoCobro, parada.motivoNoCobroTexto)}</Text>
        ) : (
          <>
            {parada.montoAcordado ? <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{`Acordado ${formatImporte(parada.montoAcordado)}`}</Text> : <View />}
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Debe ${formatImporte(parada.deudaCliente)}`}</Text>
          </>
        )}
      </View>
      {puedeCobrar ? <Button label="Cobrar" accessibilityLabel={`Cobrar en ${titulo}`} icon={HandCoins} onPress={onCobrar} /> : null}
    </View>
  )
}

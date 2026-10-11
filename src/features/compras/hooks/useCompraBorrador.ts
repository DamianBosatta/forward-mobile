import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/libs/api-client/client'
import { borradorCompraApi, comprasKeys, type GuardarCompraBody } from '@/libs/api-client/compras'
import { inicioKeys } from '@/core/query/queryClient'
import type { CompraDto, ProductoDetailDto, SocioDetailDto } from '@/libs/api-client/types'
import { useDepositoDeConsulta } from '@/features/catalogo/hooks/useDepositoDeConsulta'
import { mensajeDelServidor } from '../lib/mensaje-error'
import { detallesParaServidor, lineaDesdeDetalle, type LineaCompra } from '../lib/lineaCompra'

export interface ProveedorCompra {
  id: string
  nombre: string
  /** Condición de pago del proveedor, tal como la describe el servidor. */
  condicion: string | null
}

export type EstadoGuardado = 'nuevo' | 'guardando' | 'guardado' | 'error' | 'conflicto'

const ESPERA_AUTOGUARDADO_MS = 800

const esConflicto = (e: unknown) => (e as { status?: number })?.status === 409

/** Guardados de salida todavía en camino, por compra: reabrir el mismo borrador espera a que lleguen antes de pedirlo. */
const salidasPendientes = new Map<string, Promise<unknown>>()

async function proveedorDesdeServidor(id: string): Promise<{ proveedor: ProveedorCompra; faltantes: string[] }> {
  const s = await api.get<SocioDetailDto>(`/api/v1/socios-comerciales/${id}`)
  return {
    proveedor: { id, nombre: s.razonSocial, condicion: s.condicionPago?.descripcion ?? null },
    faltantes: s.condicionesDeCompraFaltantes ?? [],
  }
}

/**
 * Compra nueva como borrador con autoguardado (Bloque 9A, PR 3.2). El servidor la crea al elegir
 * el proveedor (POST /Compras/borradores) y cada cambio se guarda con PUT /Compras/{id}, encadenando
 * la `version` de cada respuesta. Mientras es borrador no aparece en la lista: sale de ahí al
 * guardar la nota de pedido o al confirmarla.
 */
export function useCompraBorrador(borradorInicial?: string) {
  const queryClient = useQueryClient()
  const depositoPorDefecto = useDepositoDeConsulta()
  const [compraId, setCompraId] = useState<string | null>(borradorInicial ?? null)
  const [proveedor, setProveedor] = useState<ProveedorCompra | null>(null)
  const [faltantes, setFaltantes] = useState<{ nombre: string; lista: string[] } | null>(null)
  const [depositoId, setDepositoId] = useState(depositoPorDefecto)
  const [lineas, setLineas] = useState<LineaCompra[]>([])
  const [gastos, setGastos] = useState(0)
  const [descuentoPorcentaje, setDescuento] = useState(0)
  const [estado, setEstado] = useState<EstadoGuardado>('nuevo')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!!borradorInicial)

  const version = useRef(0)
  const guardado = useRef<string | null>(null)
  const enVuelo = useRef<Promise<unknown> | null>(null)
  // Instantánea que el servidor rechazó (no por conflicto): no se reintenta sola, solo con un cambio nuevo o "Reintentar".
  const fallido = useRef<string | null>(null)
  const descartado = useRef(false)
  const enConflicto = useRef(false)
  const estadoActual = useRef<EstadoGuardado>('nuevo')
  estadoActual.current = estado

  const cuerpo = (): Omit<GuardarCompraBody, 'version'> | null =>
    compraId && proveedor
      ? { id: compraId, proveedorId: proveedor.id, depositoId, gastosOperativos: gastos, descuentoPorcentaje, detalles: detallesParaServidor(lineas) }
      : null
  const actual = cuerpo()
  const clave = actual ? JSON.stringify(actual) : null
  const ultimo = useRef(actual)
  ultimo.current = actual

  const hidratar = useCallback((c: CompraDto) => {
    version.current = c.version
    setDepositoId(c.depositoId)
    setLineas(c.detalles.map(lineaDesdeDetalle))
    setGastos(c.gastosOperativos)
    // El porcentaje que guardó el servidor (el mismo en todas las líneas), no uno recalculado desde importes redondeados.
    setDescuento(c.detalles[0]?.descuentoPorcentaje ?? 0)
  }, [])

  const cargar = useCallback(async (id: string) => {
    setCargando(true)
    try {
      await salidasPendientes.get(id)
      const c = await api.get<CompraDto>(`/api/v1/Compras/${id}`)
      const { proveedor: p } = await proveedorDesdeServidor(c.proveedorId)
      hidratar(c)
      setProveedor(p)
      guardado.current = null
      setEstado('guardado')
      setError(null)
    } catch (e) {
      setEstado('error')
      setError(mensajeDelServidor(e, 'No se pudo abrir el borrador.'))
    } finally {
      setCargando(false)
    }
  }, [hidratar])

  useEffect(() => { if (borradorInicial) void cargar(borradorInicial) }, [borradorInicial, cargar])
  // Lo que llegó del servidor ya está guardado: no se reenvía.
  useEffect(() => { if (estado === 'guardado' && guardado.current === null) guardado.current = clave }, [estado, clave])

  /** Guarda lo último que hay en pantalla (si cambió) y devuelve la versión vigente. */
  const guardarAhora = useCallback(async (): Promise<number> => {
    while (enVuelo.current) await enVuelo.current.catch(() => {})
    const c = ultimo.current
    const k = c ? JSON.stringify(c) : null
    if (!c || k === guardado.current || descartado.current) return version.current
    setEstado('guardando')
    const p = borradorCompraApi.guardar({ ...c, version: version.current }).then((r) => {
      version.current = r.version
      guardado.current = k
      fallido.current = null
    })
    enVuelo.current = p
    try {
      await p
      setEstado('guardado')
      setError(null)
    } catch (e) {
      if (!esConflicto(e)) fallido.current = k
      if (esConflicto(e)) enConflicto.current = true
      setEstado(esConflicto(e) ? 'conflicto' : 'error')
      setError(mensajeDelServidor(e, 'No se pudo guardar el borrador.'))
      throw e
    } finally {
      enVuelo.current = null
    }
    return version.current
  }, [])

  useEffect(() => {
    if (!clave || clave === guardado.current || clave === fallido.current || estado === 'conflicto' || cargando) return
    const t = setTimeout(() => { guardarAhora().catch(() => {}) }, ESPERA_AUTOGUARDADO_MS)
    return () => clearTimeout(t)
  }, [clave, estado, cargando, guardarAhora])

  // Al salir de la pantalla (volver, cerrar) lo que todavía espera el debounce se manda igual, sin esperar la respuesta.
  useEffect(() => () => {
    const c = ultimo.current
    const k = c ? JSON.stringify(c) : null
    if (!c || k === guardado.current || k === fallido.current || descartado.current || estadoActual.current === 'conflicto') return
    const previo = enVuelo.current ?? Promise.resolve()
    // Las guardas se vuelven a mirar después de esperar el guardado en vuelo: pudo haber guardado lo mismo, fallado o chocado.
    const salida = previo.catch(() => {}).then(() => {
      if (k === guardado.current || k === fallido.current || descartado.current || enConflicto.current) return undefined
      return borradorCompraApi.guardar({ ...c, version: version.current }).then(
        (r) => { version.current = r.version },
        (e) => { console.warn('No se pudo guardar el borrador al salir', e) },
      )
    }).finally(() => { if (salidasPendientes.get(c.id) === salida) salidasPendientes.delete(c.id) })
    salidasPendientes.set(c.id, salida)
  }, [])

  /** Vuelve a intentar con lo que hay en pantalla (después de un error que no fue de conflicto). */
  const reintentar = useCallback(async () => {
    fallido.current = null
    await guardarAhora().catch(() => {})
  }, [guardarAhora])

  /** Elige el proveedor y crea el borrador. Si le faltan datos de compra no sigue: se completan en la web. */
  const elegirProveedor = useCallback(async (id: string) => {
    setError(null)
    setFaltantes(null)
    try {
      const r = await proveedorDesdeServidor(id)
      if (r.faltantes.length > 0) {
        setFaltantes({ nombre: r.proveedor.nombre, lista: r.faltantes })
        return
      }
      const b = await borradorCompraApi.iniciar(id, depositoId)
      version.current = b.version
      guardado.current = null
      setProveedor(r.proveedor)
      setCompraId(b.compraId)
      setEstado('guardado')
      queryClient.invalidateQueries({ queryKey: comprasKeys.borradoresMios() })
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo empezar la compra.'))
    }
  }, [depositoId, queryClient])

  /** Precarga el último costo de la ficha (llega solo con permiso de ver costos). Sin costo, queda sin costo. */
  const precargarCosto = useCallback(async (productoId: string) => {
    try {
      const ficha = await api.get<ProductoDetailDto>(`/api/v1/Productos/${productoId}`)
      const costo = ficha?.precioCompraBase
      if (typeof costo !== 'number' || costo <= 0) return
      setLineas((prev) => prev.map((l) => (l.productoId === productoId && l.costoUnitario === null ? { ...l, costoUnitario: costo } : l)))
    } catch {
      // Sin costo previo: lo carga el usuario.
    }
  }, [])

  /** Desde el catálogo: cantidad en unidades; 0 quita la línea. */
  const setCantidadProducto = useCallback((prod: { id: string; nombre: string }, cantidad: number) => {
    const existe = lineas.some((l) => l.productoId === prod.id)
    if (cantidad > 0 && !existe) void precargarCosto(prod.id)
    setLineas((prev) => {
      if (cantidad <= 0) return prev.filter((l) => l.productoId !== prod.id)
      if (prev.some((l) => l.productoId === prod.id)) return prev.map((l) => (l.productoId === prod.id ? { ...l, cantidad } : l))
      return [...prev, { productoId: prod.id, nombre: prod.nombre, cantidad, unidad: 'Unidad', unidadesPorUnidad: 1, costoUnitario: null }]
    })
  }, [lineas, precargarCosto])

  const terminar = useCallback(async (accion: (id: string, v: number) => Promise<unknown>) => {
    const v = await guardarAhora()
    await accion(compraId!, v)
    queryClient.invalidateQueries({ queryKey: comprasKeys.all })
    // No es una mutación de react-query: Inicio (que el QueryClient refresca tras cada mutación) se marca a mano.
    queryClient.invalidateQueries({ queryKey: inicioKeys.all })
  }, [compraId, guardarAhora, queryClient])

  return {
    compraId, proveedor, faltantes, depositoId, setDepositoId, lineas, setLineas, gastos, setGastos,
    descuentoPorcentaje, estado, error, cargando,
    elegirProveedor, setCantidadProducto, reintentar,
    recargar: () => (compraId ? cargar(compraId) : Promise.resolve()),
    guardarNota: () => terminar((id, v) => borradorCompraApi.guardarNota(id, v)),
    confirmar: () => terminar((id) => borradorCompraApi.confirmar(id)),
    descartar: async () => {
      // Lo pendiente ya no se guarda; si hay un guardado en vuelo, se espera a que termine antes de borrar.
      descartado.current = true
      try {
        while (enVuelo.current) await enVuelo.current.catch(() => {})
        if (compraId) await borradorCompraApi.descartar(compraId)
      } catch (e) {
        descartado.current = false
        throw e
      }
      queryClient.invalidateQueries({ queryKey: comprasKeys.borradoresMios() })
    },
  }
}

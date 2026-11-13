import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Casilla, FiltroChip, Notice } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useAsignarDepositosSocio, useAsignarVendedorResponsable } from '@/libs/api-client/socios'
import { useDepositos } from '@/libs/api-client/depositos'
import { useVendedores } from '@/libs/api-client/ventas'
import type { SocioDetailDto } from '@/libs/api-client/types'

export const AVISO_UN_DEPOSITO = 'Elegí al menos un depósito.'

/**
 * Vendedor responsable y depósitos del cliente (solo edición). Cada bloque se guarda aparte, como en la web, y se
 * ve según la CAPACIDAD, nunca por el nombre del rol: el vendedor con CAP_GESTIONAR_CARTERA_CLIENTES; los depósitos
 * con CAP_VER_TODOS_LOS_DEPOSITOS y permiso de editar clientes.
 */
export function GestionDelCliente({ cliente }: { cliente: SocioDetailDto }) {
  const c = useColors()
  const puedeVendedor = useAuthStore(s => s.hasCapability('CAP_GESTIONAR_CARTERA_CLIENTES'))
  const puedeDepositos = useAuthStore(s => s.hasCapability('CAP_VER_TODOS_LOS_DEPOSITOS') && s.canDo('MOD_CLIENTES', 'update'))
  const vendedores = useVendedores(puedeVendedor)
  const depositos = useDepositos()
  const asignarVendedor = useAsignarVendedorResponsable()
  const asignarDepositos = useAsignarDepositosSocio()
  const [vendedorId, setVendedorId] = useState<string | null>(cliente.vendedorResponsableId ?? null)
  const [depositoIds, setDepositoIds] = useState<string[]>(cliente.depositoIds ?? [])
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null)
  useEffect(() => { setVendedorId(cliente.vendedorResponsableId ?? null) }, [cliente.vendedorResponsableId])
  if (!puedeVendedor && !puedeDepositos) return null

  const guardarVendedor = async () => {
    if (!vendedorId) return
    try {
      await asignarVendedor.mutateAsync({ socioId: cliente.id, vendedorResponsableId: vendedorId })
      setAviso({ tono: 'exito', texto: 'Vendedor responsable guardado.' })
    } catch (e) { setAviso({ tono: 'peligro', texto: mensajeDelServidor(e, 'No se pudo cambiar el vendedor.') }) }
  }
  const guardarDepositos = async () => {
    if (depositoIds.length === 0) return setAviso({ tono: 'peligro', texto: AVISO_UN_DEPOSITO })
    try {
      await asignarDepositos.mutateAsync({ socioId: cliente.id, depositoIds })
      setAviso({ tono: 'exito', texto: 'Depósitos guardados.' })
    } catch (e) { setAviso({ tono: 'peligro', texto: mensajeDelServidor(e, 'No se pudieron cambiar los depósitos.') }) }
  }
  const alternar = (id: string) => setDepositoIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))

  return (
    <View style={{ gap: space[4] }}>
      {puedeVendedor ? (
        <View style={{ gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Vendedor responsable</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Vendedor responsable" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {(vendedores.data ?? []).map(v => (
              <FiltroChip key={v.id} rol="radio" label={v.nombre} activo={vendedorId === v.id} onPress={() => setVendedorId(v.id)} />
            ))}
          </View>
          <Button label="Guardar vendedor" variant="secundario" onPress={() => { void guardarVendedor() }} disabled={!vendedorId || vendedorId === (cliente.vendedorResponsableId ?? null)} loading={asignarVendedor.isPending} />
        </View>
      ) : null}
      {puedeDepositos ? (
        <View style={{ gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Depósitos</Text>
          {(depositos.data ?? []).filter(d => d.activo !== false && d.id).map(d => (
            <Casilla key={d.id} label={d.nombre ?? ''} marcada={depositoIds.includes(d.id!)} onPress={() => alternar(d.id!)} />
          ))}
          <Button label="Guardar depósitos" variant="secundario" onPress={() => { void guardarDepositos() }} loading={asignarDepositos.isPending} />
        </View>
      ) : null}
      {aviso ? <Notice tone={aviso.tono === 'exito' ? 'exito' : 'peligro'}>{aviso.texto}</Notice> : null}
    </View>
  )
}

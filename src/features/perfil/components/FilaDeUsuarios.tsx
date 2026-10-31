import React from 'react'
import { Users } from 'lucide-react-native'
import { FilaDeAjuste } from '@/core/ui/fw'
import { useUsuarios } from '@/libs/api-client/admin'

/**
 * Fila "Usuarios" de Perfil (lámina MiCuenta): "Solo consulta · N usuarios". Pide la lista (una fila, solo para
 * el total) y por eso se monta únicamente con MOD_USUARIOS:Read; sin el total, o si falla, queda "Solo consulta".
 */
export function FilaDeUsuarios({ onPress }: { onPress: () => void }) {
  const total = useUsuarios({ pageNumber: 1, pageSize: 1 }).data?.totalCount
  const apoyo = typeof total === 'number' ? `Solo consulta · ${total} ${total === 1 ? 'usuario' : 'usuarios'}` : 'Solo consulta'
  return <FilaDeAjuste icono={Users} titulo="Usuarios" apoyo={apoyo} onPress={onPress} />
}

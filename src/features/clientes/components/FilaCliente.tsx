import React, { memo } from 'react'
import { ClienteCard } from './ClienteCard'

type PropsFilaCliente = Omit<React.ComponentProps<typeof ClienteCard>, 'onPress'> & { onAbrir: (id: string) => void }

/** Fila memoizada de las listas de clientes: no se vuelve a pintar mientras el cliente, su posición y `onAbrir` no cambien. */
export const FilaCliente = memo(function FilaCliente({ onAbrir, ...tarjeta }: PropsFilaCliente) {
  return <ClienteCard {...tarjeta} onPress={() => onAbrir(tarjeta.cliente.id)} />
})

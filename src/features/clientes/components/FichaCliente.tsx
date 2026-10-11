import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { direccionDeEntrega, nombreDelCliente } from '../lib/cliente'

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

/** Ficha de un cliente (lámina FichaCliente): dirección como título, nombre aparte y sus datos. */
export function FichaCliente({ id }: { id: string }) {
  const c = useColors()
  const { data: cliente, isLoading, error } = useSocio(id)

  if (isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (error || !cliente) {
    return (
      <View style={{ padding: space[4] }}>
        <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo abrir el cliente.')}</Notice>
      </View>
    )
  }

  const nombre = nombreDelCliente(cliente)
  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>
          {direccionDeEntrega(cliente)}
        </Text>
        {nombre ? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombre}</Text> : null}
      </View>
      <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
        <Text style={{ ...typeScale.seccion, color: c.text }}>Datos</Text>
        <Dato etiqueta="Dirección de entrega" valor={cliente.direccion} />
        <Dato etiqueta="Contacto" valor={cliente.nombreContacto} />
        <Dato etiqueta="Teléfono" valor={cliente.telefono} />
        <Dato etiqueta="Razón social" valor={cliente.razonSocial} />
        <Dato etiqueta="CUIT" valor={cliente.cuit} />
        <Dato etiqueta="Condición frente al IVA" valor={cliente.condicionIva} />
        <Dato etiqueta="Email" valor={cliente.email} />
      </View>
    </ScrollView>
  )
}

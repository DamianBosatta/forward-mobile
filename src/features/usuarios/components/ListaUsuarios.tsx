import React from 'react'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { FlatList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Notice, StatusChip, TopBar } from '@/core/ui/fw'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import { RequirePermission } from '@/core/auth/RequirePermission'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { useUsuarios } from '@/libs/api-client/admin'
import type { UserListDto } from '@/libs/api-client/types'
import { useAuthStore } from '@/libs/store/auth.store'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { Esqueletos, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { radii, space, typeScale, useColors } from '@/libs/theme'

const POR_PAGINA = 50

/** Nombre completo del usuario tal como llega; sin él, el correo. */
const nombreDe = (u: UserListDto) => u.nombreCompleto || [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email || 'Sin nombre'

/**
 * Usuarios de solo consulta (lámina perfil--usuarios, decisión L8 del dueño): "igual que la web",
 * con MOD_USUARIOS:Read y el endpoint de siempre. Altas, bajas y permisos quedan en la web.
 */
export function ListaUsuarios() {
  return (
    <RequirePermission module="MOD_USUARIOS" action="read" mode="screen" seccion="Usuarios">
      <Contenido />
    </RequirePermission>
  )
}

function Contenido() {
  const c = useColors()
  const router = useRouter()
  const yo = useAuthStore((s) => s.user?.id)
  const [texto, setTexto] = useFiltroPersistente('usuarios.busqueda', '')
  const busqueda = useDebouncedValue(texto.trim(), 350)
  const q = useUsuarios({ pageNumber: 1, pageSize: POR_PAGINA, searchTerm: busqueda || undefined })
  const filas = q.data?.items ?? []
  const total = q.data?.totalCount
  const subtitulo = total === undefined ? undefined : `${total} ${total === 1 ? 'usuario' : 'usuarios'}`

  const cuerpo = q.isLoading ? <View style={{ paddingHorizontal: space[4] }}><Esqueletos bloques={FILAS_CARGANDO} /></View>
    : q.isError && filas.length === 0 ? (
      <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los usuarios" accion={{ label: 'Reintentar', onPress: () => void q.refetch() }} />
    )
    : filas.length === 0 ? <EstadoDePantalla tipo="vacio" titulo={busqueda ? 'No hay usuarios con esa búsqueda.' : 'No hay usuarios.'} />
    : (
      // Propuesta Cuenta, frame 6: filas con iniciales dentro de una tarjeta sin borde, como la lista de Clientes.
      <View testID="tarjeta-usuarios" style={{ marginHorizontal: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
        {filas.map((u, i) => <FilaUsuario key={u.id ?? i} u={u} esYo={!!yo && u.id === yo} conDivisor={i > 0} />)}
      </View>
    )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Usuarios" subtitle={subtitulo} leading={{ kind: 'atras', onPress: () => router.back() }} />
      <FlatList
        data={[0]}
        keyExtractor={() => 'usuarios'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: space[4], gap: space[4], paddingBottom: space[12], width: '100%', maxWidth: 640, alignSelf: 'center' }}
        renderItem={() => (
          <View style={{ gap: space[4] }}>
            <View style={{ paddingHorizontal: space[4] }}>
              <Notice tone="info">Solo consulta. Altas, bajas y permisos se manejan desde la web.</Notice>
            </View>
            <BuscadorCartera valor={texto} onCambio={setTexto} etiqueta="Buscar por nombre o puesto" placeholder="Buscar por nombre o puesto" sobre="pantalla" grande />
            {cuerpo}
          </View>
        )}
      />
    </View>
  )
}

/** Fila de solo lectura: iniciales, nombre (· vos), puesto y estado. No se toca. */
function FilaUsuario({ u, esYo, conDivisor }: { u: UserListDto; esYo: boolean; conDivisor: boolean }) {
  const c = useColors()
  const nombre = nombreDe(u)
  const iniciales = `${u.nombre?.[0] ?? nombre[0] ?? ''}${u.apellido?.[0] ?? ''}`.toUpperCase()
  const activo = u.estaActivo !== false
  return (
    <View
      style={[
        { minHeight: 64, paddingHorizontal: space[4], paddingVertical: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
        conDivisor && { borderTopWidth: 1, borderTopColor: c.surface2 },
      ]}
    >
      <View style={{ width: 44, height: 44, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>{iniciales}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[typeScale.cuerpoDestacado, { color: c.text }]}>{esYo ? `${nombre} · vos` : nombre}</Text>
        {u.puestoNombre || u.roles?.length ? <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary }]}>{u.puestoNombre || u.roles?.join(' · ')}</Text> : null}
      </View>
      <StatusChip estado={activo ? 'entregado' : 'pendiente'} label={activo ? 'Activo' : 'Inactivo'} />
    </View>
  )
}

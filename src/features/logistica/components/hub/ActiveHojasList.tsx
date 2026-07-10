import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { MapPin, Truck, User, AlertTriangle, RotateCcw } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { GlassCard } from '@/core/ui'
import { useColors, tokens, BRAND } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'
import { useHojasDeRuta } from '@/libs/api-client/logistica'
import { EstadoHojaRuta, type HojaRutaListItemDto } from '@/libs/api-client/types'

// ─────────────────────────────────────────────────────────────────────────────
// Type alias
// ─────────────────────────────────────────────────────────────────────────────

// The list endpoint returns HojaRutaListItemDto (no detalles array).
// We use cantidadParadas for the progress label — avoids N+1 detail fetches.
type ActiveRuta = HojaRutaListItemDto

// ─────────────────────────────────────────────────────────────────────────────
// Route row
// ─────────────────────────────────────────────────────────────────────────────

function ActiveRutaRow({ ruta }: { ruta: ActiveRuta }) {
  const colors = useColors()
  const router = useRouter()
  const code = `HR-${ruta.id.substring(0, 8).toUpperCase()}`

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => {
        safeHaptics.impact('medium')
        router.push({ pathname: '/(tabs)/logistica/consola', params: { id: ruta.id } })
      }}
      style={{ marginBottom: 10 }}
    >
      <GlassCard
        style={{
          padding: 14,
          borderColor: colors.primary,
          borderWidth: 1.5,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {/* accent stripe */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
            backgroundColor: colors.primary,
          }}
        />
        <View style={{ paddingLeft: 8 }}>
          {/* Code + status badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontWeight: '800', fontSize: 14, color: colors.text, letterSpacing: 0.5 }}>
              {code}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.primary + '15',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 9, fontWeight: '900', color: colors.primary, letterSpacing: 0.5 }}>
                EN CURSO
              </Text>
            </View>
          </View>

          {/* Chofer + Patente */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.surface2,
                paddingHorizontal: 9,
                paddingVertical: 7,
                borderRadius: 8,
              }}
            >
              <User size={12} color={colors.primary} />
              <Text
                style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '700', flex: 1 }}
                numberOfLines={1}
              >
                {ruta.choferNombre}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.surface2,
                paddingHorizontal: 9,
                paddingVertical: 7,
                borderRadius: 8,
              }}
            >
              <Truck size={12} color={colors.primary} />
              <Text
                style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '700', flex: 1 }}
                numberOfLines={1}
              >
                {ruta.vehiculoPatente}
              </Text>
            </View>
          </View>

          {/* Stops count */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <MapPin size={12} color={BRAND.violet} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
              {ruta.cantidadParadas} paradas
            </Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ActiveHojasList — shows all EnCurso (estado=2) hojas de ruta.
 *
 * Uses GET /api/v1/Logistica/hojas-ruta?estado=2. Display is based on
 * HojaRutaListItemDto (cantidadParadas for stop count — avoids N+1 fetches).
 * tripProgress() is available in viajes-logic.ts when per-stop detail is needed
 * (e.g., consola screen); the hub summary only needs the count.
 */
export function ActiveHojasList() {
  const colors = useColors()
  const { data: rutas, isLoading, isError, refetch } = useHojasDeRuta({ estado: EstadoHojaRuta.EnCurso })

  if (isLoading) {
    return (
      <View style={{ paddingVertical: tokens.spacing.md, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (isError) {
    return (
      <View
        style={{
          paddingVertical: tokens.spacing.lg,
          paddingHorizontal: tokens.spacing.md,
          alignItems: 'center',
          backgroundColor: colors.surface2,
          borderRadius: tokens.radius.lg,
        }}
      >
        <AlertTriangle size={32} color={colors.danger} style={{ marginBottom: 8 }} />
        <Text
          style={{
            fontSize: 13,
            color: colors.text,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 2,
          }}
        >
          No se pudieron cargar los viajes
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Verificá tu conexión e intentá nuevamente.
        </Text>
        <TouchableOpacity
          onPress={() => {
            safeHaptics.impact('light')
            refetch()
          }}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: tokens.radius.md,
          }}
          accessibilityLabel="Reintentar"
          accessibilityRole="button"
        >
          <RotateCcw size={14} color="#000" strokeWidth={2.5} />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#000' }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!rutas || rutas.length === 0) {
    return (
      <View
        style={{
          paddingVertical: tokens.spacing.lg,
          paddingHorizontal: tokens.spacing.md,
          alignItems: 'center',
          backgroundColor: colors.surface2,
          borderRadius: tokens.radius.lg,
        }}
      >
        <Truck size={32} color={colors.textDisabled} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600', textAlign: 'center' }}>
          No hay viajes en curso
        </Text>
      </View>
    )
  }

  return (
    <View>
      {rutas.map((ruta) => (
        <ActiveRutaRow key={ruta.id} ruta={ruta} />
      ))}
    </View>
  )
}

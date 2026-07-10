import React, { useState, useMemo } from 'react'
import {
  View, Text, RefreshControl, Pressable, TextInput,
  ActivityIndicator, TouchableOpacity, StyleSheet, Platform
} from 'react-native'
import { FlashList } from '@shopify/flash-list'

const AnyFlashList = FlashList as any
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { safeHaptics } from '@/core/utils/haptics'
import { Search, MapPin, Plus, Building2, Power, Filter, Activity, Check, ChevronRight } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { ConfirmModal, GlassCard, ForwardLogo, TopHeaderActions, RequirePermission } from '@/core/ui'
import { useAuthStore } from '@/libs/store/auth.store'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { MotiView } from 'moti'
import { useDepositos, useDeactivateDeposito } from '@/features/inventario/api/queries'
import { LinearGradient } from 'expo-linear-gradient'
import type { Deposito } from '@/libs/api-client/types'

// ─── FilterPill Premium ──────────────────────────────────────────────────────
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors()
  return (
    <Pressable
      onPress={() => { safeHaptics.impact('light'); onPress(); }}
      style={({ pressed }) => [
        {
          paddingHorizontal: 20, paddingVertical: 10,
          backgroundColor: active ? colors.primary : colors.surface2,
          borderRadius: 14, opacity: pressed ? 0.7 : 1,
          borderWidth: 1, borderColor: active ? colors.primary : colors.border
        }
      ]}
    >
      <Text style={{ 
        color: active ? colors.bg : colors.textMuted, 
        fontWeight: '900', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase'
      }}>{label}</Text>
    </Pressable>
  )
}

// ── KpiCard Premium ──────────────────────────────────────────────────────────
function KpiCard({ label, value, color, Icon, delay = 0 }: { label: string; value: string; color: string; Icon: any; delay?: number }) {
  const colors = useColors()
  const isDark = useIsDark()
  return (
    <MotiView 
      from={{ opacity: 0, translateY: 10 }} 
      animate={{ opacity: 1, translateY: 0 }} 
      transition={{ type: 'spring', delay, damping: 15 }} 
      style={{ flex: 1 }}
    >
      <View style={{
        backgroundColor: isDark ? '#0D0D0D' : colors.surface,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        overflow: 'hidden'
      }}>
        <LinearGradient
          colors={[color + '10', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ 
          width: 36, height: 36, borderRadius: 10, 
          backgroundColor: color + '15', 
          alignItems: 'center', justifyContent: 'center', 
          marginBottom: 8,
          borderWidth: 1,
          borderColor: color + '20'
        }}>
          <Icon size={18} color={color} />
        </View>
        <Text style={{ 
          fontSize: 24, 
          color: colors.text, 
          letterSpacing: -1,
          fontFamily: 'Outfit_900Black'
        }}>
          {value}
        </Text>
        <Text style={{ 
          fontSize: 8, 
          color: colors.textMuted, 
          fontWeight: '900', 
          textTransform: 'uppercase', 
          letterSpacing: 1.5, 
          marginTop: 2,
          fontFamily: 'Outfit_800ExtraBold'
        }}>
          {label}
        </Text>
      </View>
    </MotiView>
  )
}

// ── DepositoCard Premium ─────────────────────────────────────────────────────
function DepositoCard({ item, index, onEdit, onDeactivate }: { item: Deposito, index: number, onEdit: () => void, onDeactivate: () => void }) {
  const colors = useColors()
  const isDark = useIsDark()

  return (
    <MotiView 
      from={{ opacity: 0, translateY: 20 }} 
      animate={{ opacity: 1, translateY: 0 }} 
      transition={{ delay: index * 50, type: 'spring' }}
    >
      <Pressable 
        onPress={() => {
          safeHaptics.impact('medium')
          onEdit()
        }}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      >
        <GlassCard
          intensity={5}
          style={{
            borderRadius: 24,
            marginBottom: 16,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: item.activo ? colors.success : colors.danger,
          }}
        >
          <View style={styles.cardContent}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {/* Icono con Glow */}
              <View style={[
                styles.depoIconContainer, 
                { 
                  backgroundColor: item.activo ? colors.primary + '10' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  borderWidth: 1,
                  borderColor: item.activo ? colors.primary + '20' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                }
              ]}>
                <Building2 size={24} color={item.activo ? colors.primary : colors.textDisabled} />
                {item.activo && <MotiView 
                  from={{ opacity: 0.3, scale: 0.8 }} 
                  animate={{ opacity: 1, scale: 1.2 }} 
                  transition={{ loop: true, duration: 2000, type: 'timing' }}
                  style={[styles.glowDot, { backgroundColor: colors.success, borderColor: isDark ? '#000' : '#fff' }]} 
                />}
              </View>

              {/* Info Principal */}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ 
                    fontSize: 16, 
                    color: item.activo ? colors.text : colors.textDisabled,
                    fontFamily: 'Outfit_700Bold',
                    letterSpacing: -0.3
                  }}>
                    {(item.nombre ?? '').toUpperCase()}
                  </Text>
                  {!item.activo && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.danger + '15' }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.danger, fontFamily: 'Outfit_900Black' }]}>INACTIVO</Text>
                    </View>
                  )}
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <MapPin size={10} color={colors.textMuted} />
                  <Text style={{ 
                    fontSize: 11, 
                    color: colors.textMuted,
                    fontFamily: 'Outfit_500Medium',
                    flex: 1 
                  }} numberOfLines={1}>
                    {item.direccion || 'UBICACIÓN NO ESPECIFICADA'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Footer de Acciones */}
            <View style={[styles.cardFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {item.activo && (
                  <TouchableOpacity 
                    onPress={(e) => {
                      e.stopPropagation() // Evitar que dispare el onEdit de la card
                      onDeactivate()
                    }}
                    style={[styles.actionButton, { backgroundColor: colors.danger + '10' }]}
                  >
                    <Power size={14} color={colors.danger} />
                    <Text style={[styles.actionButtonText, { color: colors.danger, fontFamily: 'Outfit_700Bold' }]}>DESACTIVAR</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View 
                style={{ 
                  width: 36, height: 36, borderRadius: 10, 
                  backgroundColor: colors.primary + '10',
                  alignItems: 'center', justifyContent: 'center' 
                }}
              >
                <ChevronRight size={18} color={colors.primary} />
              </View>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </MotiView>
  )
}

export default function DepositosScreen() {
  const navigation = useNavigation()
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { data: depositos = [], isLoading, isRefetching, refetch } = useDepositos()

  // Depósito is management-only — a vendedor (Empleado) must not reach it even via deep link.
  const { isAdmin, hasRole } = useAuthStore()
  const isManagement = !!(isAdmin?.() || hasRole?.('Gerencia'))

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Activos' | 'Inactivos'>('Todos')
  const [deactivateModal, setDeactivateModal] = useState(false)
  const [selectedDepo, setSelectedDepo] = useState<Deposito | null>(null)
  const [targetDepoId, setTargetDepoId] = useState<string | null>(null)
  const [showTargetSelector, setShowTargetSelector] = useState(false)

  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateDeposito()

  const filtered = useMemo(() => {
    return depositos.filter(d => {
      const matchSearch = (d.nombre ?? '').toLowerCase().includes(search.toLowerCase()) || (d.direccion ?? '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'Todos' || (statusFilter === 'Activos' ? d.activo : !d.activo)
      return matchSearch && matchStatus
    })
  }, [depositos, search, statusFilter])

  const activeCount = depositos.filter(d => d.activo).length

  const handleDeactivate = () => {
    if (!selectedDepo) return
    safeHaptics.notification('warning')
    deactivate({ id: selectedDepo.id!, targetDepositoId: targetDepoId || undefined }, {
      onSuccess: () => {
        setDeactivateModal(false)
        setSelectedDepo(null)
        setTargetDepoId(null)
        setShowTargetSelector(false)
      }
    })
  }

  if (!isManagement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>Sin acceso</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 18 }}>
          El módulo de depósito es solo para administración.
        </Text>
      </View>
    )
  }

  return (
    <RequirePermission module="MOD_STOCK" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* ── Aurora Glow Effect ── */}
        <LinearGradient
          colors={[colors.primary + '10', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
        />

        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={{
          paddingTop: insets.top + 20, paddingBottom: 20, paddingHorizontal: 20, zIndex: 100
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MotiView
                from={{ scale: 0.5, opacity: 0, rotate: '-20deg' }}
                animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
                transition={{ type: 'spring', damping: 12, delay: 100 }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                  style={{ 
                    width: 48, height: 48, borderRadius: 16, 
                    backgroundColor: isDark ? '#111' : colors.surface, 
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <ForwardLogo size={32} showText={false} />
                </TouchableOpacity>
              </MotiView>
              <View>
                <Text style={{ 
                  fontSize: 22, 
                  color: colors.text, 
                  fontFamily: 'Outfit_900Black',
                  letterSpacing: -1 
                }}>
                  DEPÓSITOS
                </Text>
                <View style={styles.liveBadge}>
                  <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.liveText, { color: colors.success, fontFamily: 'Outfit_800ExtraBold' }]}>OPERACIONES DE STOCK</Text>
                </View>
              </View>
            </View>
            <TopHeaderActions />
          </View>

          <View style={[styles.searchContainer, { backgroundColor: isDark ? '#111' : colors.surface, borderWidth: 1, borderColor: colors.border }]}>
            <Search size={18} color={colors.primary} />
            <TextInput
              placeholder="BUSCAR EN EL REGISTRO..."
              placeholderTextColor={colors.textDisabled}
              style={[styles.searchInput, { color: colors.text, fontFamily: 'Outfit_700Bold' }]}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </BlurView>

        <AnyFlashList
          data={filtered}
          estimatedItemSize={180}
          keyExtractor={(item: any) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
          ListHeaderComponent={
            <MotiView from={{ opacity: 0, translateY: -20 }} animate={{ opacity: 1, translateY: 0 }}>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                <KpiCard label="Total" value={String(depositos.length)} color={colors.textMuted} Icon={Building2} />
                <KpiCard label="Activos" value={String(activeCount)} color={colors.primary} Icon={Check} delay={100} />
                <KpiCard label="Inactivos" value={String(depositos.length - activeCount)} color={colors.danger} Icon={Activity} delay={200} />
              </View>

              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Filter size={12} color={colors.textDisabled} />
                  <Text style={{ fontSize: 9, color: colors.textDisabled, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Outfit_900Black' }}>Filtros de Estado</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {(['Todos', 'Activos', 'Inactivos'] as const).map((f) => (
                    <FilterPill key={f} label={f === 'Inactivos' ? 'Fuera de Servicio' : f} active={statusFilter === f} onPress={() => setStatusFilter(f)} />
                  ))}
                </View>
              </View>
            </MotiView>
          }
          renderItem={({ item, index }: { item: any; index: number }) => (
            <DepositoCard 
              item={item} 
              index={index} 
              onEdit={() => {
                router.push({ pathname: '/(tabs)/inventario/depositos/nuevo', params: { id: item.id } })
              }}
              onDeactivate={() => {
                setSelectedDepo(item)
                setDeactivateModal(true)
              }}
            />
          )}
          ListEmptyComponent={
            isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <GlassCard intensity={5} style={{ padding: 40, borderRadius: 30, alignItems: 'center' }}>
                  <Building2 size={48} color={colors.textDisabled} strokeWidth={1} />
                  <Text style={{ color: colors.textDisabled, marginTop: 16, fontWeight: '900', fontSize: 10, letterSpacing: 2 }}>SIN RESULTADOS</Text>
                </GlassCard>
              </View>
            )
          }
        />

        <RequirePermission module="MOD_STOCK" action="create">
          <MotiView
            from={{ scale: 0, rotate: '-45deg' }}
            animate={{ scale: 1, rotate: '0deg' }}
            transition={{ type: 'spring', delay: 400 }}
            style={[styles.fab, { bottom: insets.bottom + 20 }]}
          >
            <TouchableOpacity onPress={() => { safeHaptics.impact('heavy'); router.push('/(tabs)/inventario/depositos/nuevo'); }}>
              <LinearGradient colors={[colors.primary, colors.primaryHover]} style={styles.fabGradient}>
                <Plus size={32} color={colors.bg} strokeWidth={3} />
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>
        </RequirePermission>

        <ConfirmModal
          visible={deactivateModal}
          title="DESACTIVAR DEPÓSITO"
          message={`¿CONFIRMÁS LA DESACTIVACIÓN DE ${(selectedDepo?.nombre ?? '').toUpperCase()}? SI TIENE STOCK, DEBERÁS TRANSFERIRLO A OTRO ALMACÉN.`}
          variant="danger"
          onConfirm={() => {
            if (depositos.length > 1) {
              setShowTargetSelector(true)
            } else {
              handleDeactivate()
            }
          }}
          onCancel={() => { setDeactivateModal(false); setShowTargetSelector(false); }}
        />

        {showTargetSelector && (
          <ConfirmModal
            visible={true}
            title="SELECCIONAR DESTINO"
            message="ESTE DEPÓSITO TIENE EXISTENCIAS ACTIVAS. ¿A DÓNDE QUERÉS TRANSFERIR EL STOCK?"
            onConfirm={handleDeactivate}
            onCancel={() => setShowTargetSelector(false)}
          >
            <View style={{ marginTop: 20, gap: 10 }}>
              {depositos.filter(d => d.id !== selectedDepo?.id && d.activo).map(d => (
                <TouchableOpacity 
                  key={d.id}
                  onPress={() => { safeHaptics.impact('light'); setTargetDepoId(d.id ?? null); }}
                  style={{
                    padding: 18, borderRadius: 16, borderWidth: 2,
                    borderColor: targetDepoId === d.id ? colors.primary : colors.border,
                    backgroundColor: targetDepoId === d.id ? `${colors.primary}10` : colors.surface2,
                    flexDirection: 'row', alignItems: 'center', gap: 14
                  }}
                >
                  <MapPin size={20} color={targetDepoId === d.id ? colors.primary : colors.textDisabled} />
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 14 }}>{(d.nombre ?? '').toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ConfirmModal>
        )}
      </View>
    </RequirePermission>
  )
}

const styles = StyleSheet.create({
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot: { width: 4, height: 4, borderRadius: 2 },
  liveText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, height: 56, paddingHorizontal: 20 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  
  cardContent: { padding: 20 },
  depoIconContainer: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glowDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionButtonText: { fontSize: 10, letterSpacing: 0.5 },

  fab: { position: 'absolute', right: 24, shadowColor: '#4278ff', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20 },
  fabGradient: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }
})

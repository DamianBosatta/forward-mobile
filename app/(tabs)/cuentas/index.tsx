import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'

const AnyFlashList = FlashList as any
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView } from 'moti'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import { BlurView } from 'expo-blur'
import {
  Plus,
  Landmark,
  PiggyBank,
  Wallet,
  Search,
  Users,
} from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { TopHeaderActions, RequirePermission, ForwardLogo, AuroraGlow, GlassCard, SegmentedControl } from '@/core/ui'
import { useCuentasResumen, type TabType } from '@/features/cuentas/hooks/useCuentasResumen'
import { AccountsKpiCards } from '@/features/cuentas/components/AccountsKpiCards'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(amount: number) {
  return amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getIconForAccountName(name: string, color: string) {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('ahorro')) return <PiggyBank size={18} color={color} />
  if (lowerName.includes('sueldo')) return <Wallet size={18} color={color} />
  return <Landmark size={18} color={color} />
}

// ─── Componentes ──────────────────────────────────────────────────────────────

export default function ResumenCuentasScreen() {
  const navigation = useNavigation();
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { state, data, actions } = useCuentasResumen()
  const { activeTab, searchQuery, refreshing, isLoading } = state
  const { currentData, liquidez, counts, totalACobrar, totalAPagar } = data

  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // ── Helper: color de saldo según tipo de cuenta ────────────────────────────────
  const getSaldoColor = (saldo: number, tipoSocio?: 'clientes' | 'proveedores'): string => {
    if (saldo === 0) return colors.text
    if (!tipoSocio) {
      return saldo > 0 ? colors.success : colors.danger
    }
    const isCliente = tipoSocio === 'clientes'
    if (isCliente) {
      return saldo > 0 ? colors.danger : colors.success
    } else {
      return saldo < 0 ? colors.danger : colors.success
    }
  }

  const handleCardPress = (id: string) => {
    Haptics.selectionAsync()
    router.push(`/(tabs)/cuentas/${id}` as any)
  }

  const tabOptions = ['PROPIAS', 'CLIENTES', 'PROVEEDORES']
  const activeIndex = useMemo(() => {
    if (activeTab === 'propias') return 0
    if (activeTab === 'clientes') return 1
    return 2
  }, [activeTab])

  const handleTabChange = (index: number) => {
    Haptics.selectionAsync()
    const tabs: TabType[] = ['propias', 'clientes', 'proveedores']
    actions.setActiveTab(tabs[index])
  }

  return (
    <RequirePermission module="MOD_CC" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AuroraGlow color={isDark ? colors.primary : '#006d60'} opacity={isDark ? 0.15 : 0.08} />

        {/* Sticky Header Premium */}
        <View style={{ zIndex: 100 }}>
          <BlurView intensity={isDark ? 20 : 60} tint={isDark ? 'dark' : 'light'} style={{ paddingTop: insets.top + 10, paddingBottom: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }}
                  style={[
                    styles.premiumBrandCircle,
                    {
                      backgroundColor: isDark ? '#111111' : '#f5f5f7',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                    }
                  ]}
                >
                  <ForwardLogo size={32} showText={false} />
                </TouchableOpacity>
                <View>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, fontFamily: 'Outfit_900Black', letterSpacing: -1 }}>FINANZAS</Text>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.statusText, { color: colors.primary }]}>TERMINAL ACTIVA</Text>
                  </View>
                </View>
              </View>
              <TopHeaderActions />
            </View>

            {/* Search & Filter Bar */}
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              <View style={[
                styles.searchBar, 
                { 
                  backgroundColor: isSearchFocused 
                    ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') 
                    : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                  borderColor: isSearchFocused ? colors.primary : 'transparent',
                  borderWidth: 1,
                }
              ]}>
                <Search size={18} color={isSearchFocused ? colors.primary : (isDark ? '#525252' : '#8e8e93')} />
                <TextInput
                  placeholder="Buscar cuenta o socio..."
                  placeholderTextColor={isDark ? '#525252' : '#8e8e93'}
                  style={[styles.searchInputPremium, { color: colors.text }]}
                  value={searchQuery}
                  onChangeText={actions.setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
              </View>

              <SegmentedControl 
                options={tabOptions} 
                selectedIndex={activeIndex} 
                onChange={handleTabChange} 
              />
            </View>
          </BlurView>
        </View>

        <AnyFlashList
          data={currentData}
          keyExtractor={(item: any) => item.id}
          estimatedItemSize={150}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 130 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={actions.onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <>
              <AccountsKpiCards
                totalLiquidez={liquidez?.totalDisponible || 0}
                crecimiento={liquidez?.mensajeCrecimiento ?? undefined}
                propiasCount={counts.propias}
                sociosCount={counts.clientes + counts.proveedores}
                totalACobrar={totalACobrar}
                totalAPagar={totalAPagar}
              />
              
              <View style={styles.listHeaderTitle}>
                <View style={[styles.titleIndicator, { backgroundColor: colors.primary }]} />
                <Text style={[styles.titleText, { color: colors.textMuted }]}>CARTERA DE {activeTab.toUpperCase()} ({currentData.length})</Text>
              </View>
            </>
          }
          renderItem={({ item, index }: { item: any; index: number }) => {
            const balanceColor = getSaldoColor(item.saldoActual, activeTab === 'propias' ? undefined : activeTab)
            
            // Lógica dinámica de cartel e indicador menos (-)
            const tipoSocio = activeTab === 'propias' ? undefined : activeTab
            let hasMinus = false
            let displayValue = formatMoney(Math.abs(item.saldoActual))
            let label = 'DISPONIBLE'
            
            if (tipoSocio) {
              const isCliente = tipoSocio === 'clientes'
              if (isCliente) {
                if (item.saldoActual > 0) {
                  hasMinus = true
                  label = 'NOS DEBE'
                } else {
                  label = 'DISPONIBLE'
                }
              } else { // Proveedores
                if (item.saldoActual < 0) {
                  hasMinus = true
                  label = 'NOS DEBE'
                } else {
                  label = 'DISPONIBLE'
                }
              }
            } else {
              label = 'DISPONIBLE'
              if (item.saldoActual < 0) {
                hasMinus = true
              }
            }

            return (
              <MotiView
                from={{ opacity: 0, scale: 0.9, translateY: 20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 400, delay: Math.min(index * 50, 300) }}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleCardPress(item.id)}
                  style={{ marginBottom: 12 }}
                >
                  <GlassCard intensity={item.esPrincipal ? 20 : 5} style={[
                    styles.accountCard,
                    { borderColor: item.activo ? colors.success : colors.danger },
                    item.esPrincipal && { backgroundColor: colors.primary + (isDark ? '05' : '10') }
                  ]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.accountName, { color: item.esPrincipal ? colors.primary : colors.text }]}>
                          {item.nombre}
                        </Text>
                        {item.razonSocial && (
                          <Text style={[styles.accountSub, { color: colors.textMuted }]}>
                            {item.razonSocial}
                          </Text>
                        )}
                        <Text style={[styles.accountId, { color: colors.textMuted, opacity: 0.6 }]}>
                          ID: {(item.id.slice(-8)).toUpperCase()}
                        </Text>
                      </View>
                      <View style={[
                        styles.iconCircle,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
                        }
                      ]}>
                        {getIconForAccountName(item.nombre, item.esPrincipal ? colors.primary : colors.textMuted)}
                      </View>
                    </View>

                    <View>
                      <Text style={[styles.saldoLabel, { color: colors.textMuted }]}>{label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        {hasMinus && <Text style={[styles.currency, { color: balanceColor }]}>-</Text>}
                        <Text style={[styles.currency, { color: balanceColor }]}>$</Text>
                        <Text style={[styles.amount, { color: balanceColor }]}>
                          {displayValue}
                        </Text>
                      </View>
                    </View>

                    {!item.activo && (
                      <View style={styles.archivedBadge}>
                        <Text style={styles.archivedText}>Archivada</Text>
                      </View>
                    )}
                    
                    {item.esPrincipal && (
                      <View style={[
                        styles.principalBadge,
                        {
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255,255,255,0.6)',
                          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
                        }
                      ]}>
                        <Text style={[styles.principalText, { color: colors.primary }]}>PRINCIPAL</Text>
                      </View>
                    )}
                  </GlassCard>
                </TouchableOpacity>
              </MotiView>
            )
          }}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <GlassCard intensity={10} style={styles.emptyCard}>
                  <Users size={48} color={colors.textMuted} strokeWidth={1} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>SIN REGISTROS</Text>
                </GlassCard>
              </View>
            ) : (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            )
          }
        />

        {/* FAB Observatorio */}
        <RequirePermission module="MOD_CC" action="create">
          <MotiView
            from={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 500 }}
            style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20 }}
          >
            <TouchableOpacity
              onPress={() => {
                safeHaptics.impact('medium')
                router.push('/(tabs)/cuentas/nueva')
              }}
              style={[
                styles.fab,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary
                }
              ]}
            >
              <Plus size={32} color="#000000" strokeWidth={3} />
            </TouchableOpacity>
          </MotiView>
        </RequirePermission>
      </View>
    </RequirePermission>
  )
}

const styles = StyleSheet.create({
  premiumBrandCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 18,
    paddingHorizontal: 18,
    gap: 12,
  },
  searchInputPremium: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  listHeaderTitle: {
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIndicator: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 10,
    color: '#525252',
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1.5,
  },
  accountCard: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  accountName: {
    fontSize: 18,
    fontFamily: 'Outfit_900Black',
    textTransform: 'uppercase',
  },
  accountSub: {
    color: '#737373',
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 2,
  },
  accountId: {
    color: '#404040',
    fontSize: 10,
    fontFamily: 'Menlo',
    marginTop: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  saldoLabel: {
    color: '#525252',
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  currency: {
    fontSize: 18,
    fontFamily: 'Outfit_900Black',
    marginRight: 4,
  },
  amount: {
    fontSize: 28,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -1,
  },
  archivedBadge: {
    position: 'absolute',
    top: 24,
    right: 75,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  archivedText: {
    color: '#ef4444',
    fontSize: 10,
    fontFamily: 'Outfit_900Black',
    textTransform: 'uppercase',
  },
  principalBadge: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  principalText: {
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyCard: {
    padding: 40,
    width: 280,
    alignItems: 'center',
    gap: 16,
    borderRadius: 32,
  },
  emptyText: {
    color: '#404040',
    fontFamily: 'Outfit_900Black',
    letterSpacing: 2,
    fontSize: 12,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  }
})

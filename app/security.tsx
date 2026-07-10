import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Shield, 
  Smartphone, 
  Globe, 
  MapPin, 
  LogOut, 
  ChevronRight, 
  AlertTriangle,
  Fingerprint,
  Bell,
  Lock,
  RefreshCw,
  User
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInRight, 
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { useSecurity } from '@/src/features/security/hooks/useSecurity';
import { useColors, tokens } from '@/libs/theme';
import { GlassCard } from '@/core/ui';
// import { formatDistanceToNow } from 'date-fns';
// import { es } from 'date-fns/locale';

/**
 * Simple polyfill for formatDistanceToNow in Spanish
 */
const formatDistanceToNowSpanish = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'hace un momento';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `hace ${diffInMinutes} min`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `hace ${diffInHours} h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `hace ${diffInDays} días`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `hace ${diffInMonths} meses`;
  
  return 'hace mucho tiempo';
};

const SecurityCenterScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const { sessions, logs, isLoading, isError, refetch, revokeSession, isRevoking } = useSecurity();

  const handleRevoke = async (sessionId: string, deviceName: string) => {
    Alert.alert(
      'Cerrar Sesión',
      `¿Estás seguro de que quieres cerrar la sesión en ${deviceName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeSession(sessionId);
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar la sesión. Inténtalo de nuevo.');
            }
          }
        }
      ]
    );
  };

  const formatLastActive = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNowSpanish(date);
    } catch (e) {
      return 'Desconocido';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ 
        headerShown: false,
        title: 'Centro de Seguridad'
      }} />

      {/* Fondo con Gradientes */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[colors.surface, colors.background, colors.background]}
          style={{ flex: 1 }}
        />
        <View 
          style={{ 
            position: 'absolute', 
            top: -100, 
            right: -100, 
            width: 300, 
            height: 300, 
            borderRadius: 150, 
            backgroundColor: colors.primary, 
            opacity: 0.1,
            filter: 'blur(80px)'
          } as any} 
        />
      </View>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View 
          entering={FadeInDown.duration(800)}
          style={{ paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.xl }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Shield size={32} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: '900', marginLeft: 12, letterSpacing: -1 }}>
                SEGURIDAD
              </Text>
            </View>
            <TouchableOpacity onPress={() => refetch()} disabled={isLoading}>
              <RefreshCw size={20} color={colors.primary} style={{ opacity: isLoading ? 0.5 : 1 }} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>
            Monitorea y protege tu cuenta en tiempo real.
          </Text>
        </Animated.View>

        {/* Security Health Card */}
        <Animated.View 
          entering={FadeInDown.delay(200).duration(800)}
          style={{ marginHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.xl }}
        >
          <GlassCard intensity={15} style={{ padding: 24, borderRadius: tokens.radius.xl, borderWidth: 1, borderColor: colors.glassBorder }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1.5 }}>Estado General</Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>Tu cuenta está segura</Text>
              </View>
              <MotiView
                from={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ loop: true, duration: 2000, type: 'timing' }}
                style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ backgroundColor: `${colors.success}15`, borderRadius: tokens.radius.full, borderWidth: 1, borderColor: `${colors.success}30`, flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: colors.success, fontSize: 10, fontWeight: '900' }}>MFA ACTIVO</Text>
              </View>
              <View style={{ backgroundColor: `${colors.success}15`, borderRadius: tokens.radius.full, borderWidth: 1, borderColor: `${colors.success}30`, flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: colors.success, fontSize: 10, fontWeight: '900' }}>BIOMETRÍA</Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Active Sessions Section */}
        <View style={{ marginBottom: tokens.spacing.xl }}>
          <View style={{ paddingHorizontal: tokens.spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>Sesiones Activas</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{sessions.length} dispositivos</Text>
          </View>

          {isLoading ? (
            <View style={{ paddingHorizontal: tokens.spacing.lg, paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{ color: colors.textSecondary, marginTop: 16, fontWeight: '600' }}>Cargando sesiones...</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: tokens.spacing.lg, paddingRight: tokens.spacing.md }}
            >
              {sessions.map((session, index) => (
                <Animated.View 
                  key={session.id}
                  entering={FadeInRight.delay(400 + (index * 100)).duration(600)}
                  style={{ marginRight: tokens.spacing.md, width: 280 }}
                >
                  <GlassCard intensity={10} style={{ padding: 20, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: colors.glassBorder }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <View style={{ padding: 12, backgroundColor: `${colors.primary}15`, borderRadius: tokens.radius.md }}>
                        {session.device.toLowerCase().includes('iphone') || session.device.toLowerCase().includes('android') || session.device.toLowerCase().includes('mobile') ? (
                          <Smartphone size={24} color={colors.primary} />
                        ) : (
                          <Globe size={24} color={colors.primary} />
                        )}
                      </View>
                      {session.isCurrent && (
                        <View style={{ backgroundColor: `${colors.primary}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Actual</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{session.device}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                      <MapPin size={12} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>{session.ip}</Text>
                      <Text style={{ color: colors.textSecondary, marginHorizontal: 8 }}>•</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatLastActive(session.createdAt)}</Text>
                    </View>
                    
                    {!session.isCurrent && (
                      <TouchableOpacity 
                        onPress={() => handleRevoke(session.id, session.device)}
                        disabled={isRevoking}
                        style={{ backgroundColor: `${colors.danger}15`, paddingVertical: 12, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: `${colors.danger}30`, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                      >
                        {isRevoking ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <>
                            <LogOut size={16} color={colors.danger} />
                            <Text style={{ color: colors.danger, fontWeight: '900', marginLeft: 8 }}>Cerrar Sesión</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </GlassCard>
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Security Controls */}
        <View style={{ paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.xl }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 16 }}>Controles de Acceso</Text>
          
          {[
            { icon: Fingerprint, label: 'Autenticación Biométrica', status: 'Activado', color: colors.primary },
            { icon: Lock, label: 'Cambiar Contraseña', status: 'Último cambio: 3 meses', color: colors.textSecondary },
            { icon: Bell, label: 'Alertas de Inicio de Sesión', status: 'Activado', color: colors.primary },
          ].map((item, index) => (
            <Animated.View 
              key={item.label}
              entering={FadeInDown.delay(600 + (index * 100)).duration(500)}
              style={{ marginBottom: 12 }}
            >
              <TouchableOpacity activeOpacity={0.8}>
                <GlassCard intensity={10} style={{ padding: 16, borderRadius: tokens.radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.glassBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ padding: 10, backgroundColor: `${item.color}15`, borderRadius: tokens.radius.md, marginRight: 16 }}>
                      <item.icon size={22} color={item.color} />
                    </View>
                    <View>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{item.label}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.status}</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textSecondary} />
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Admin Management Section */}
        <View style={{ paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.xl }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 16 }}>Gestión Administrativa</Text>
          
          {[
            { 
              icon: Shield, 
              label: 'Perfiles de Permisos', 
              desc: 'Configurar permisos granulares por módulo', 
              route: '/security/profiles',
              color: colors.primary
            },
            { 
              icon: User, 
              label: 'Asignación de Roles', 
              desc: 'Vincular usuarios con roles del sistema', 
              route: '/security/users',
              color: colors.secondary
            },
          ].map((item, index) => (
            <Animated.View 
              key={item.label}
              entering={FadeInDown.delay(700 + (index * 100)).duration(500)}
              style={{ marginBottom: 12 }}
            >
              <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(item.route as any)}>
                <GlassCard intensity={15} style={{ padding: 20, borderRadius: tokens.radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.glassBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ padding: 12, backgroundColor: `${item.color}15`, borderRadius: tokens.radius.lg, marginRight: 16 }}>
                      <item.icon size={24} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{item.label}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>{item.desc}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: `${item.color}10`, padding: 8, borderRadius: tokens.radius.full }}>
                    <ChevronRight size={18} color={item.color} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Recent Activity Section */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-semibold">Actividad Reciente</Text>
            <TouchableOpacity>
              <Text className="text-indigo-300 font-medium">Ver historial</Text>
            </TouchableOpacity>
          </View>

          {logs.length === 0 ? (
            <BlurView intensity={10} tint="dark" className="p-6 rounded-2xl border border-white/5 items-center">
              <Shield size={24} color={colors.textSecondary} opacity={0.5} />
              <Text className="text-slate-500 mt-2">No hay actividad reciente registrada.</Text>
            </BlurView>
          ) : (
            logs.map((log, index) => (
              <Animated.View 
                key={log.id}
                entering={FadeInDown.delay(800 + (index * 100)).duration(500)}
                className="mb-3"
              >
                <BlurView intensity={10} tint="dark" className="p-4 rounded-2xl flex-row items-center justify-between border border-white/5">
                  <View className="flex-row items-center flex-1">
                    <View className={`p-2 rounded-lg mr-4 ${log.exitoso ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <AlertTriangle size={20} color={log.exitoso ? colors.success : colors.danger} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium" numberOfLines={1}>
                        {log.exitoso ? 'Inicio de sesión exitoso' : 'Intento fallido'}
                      </Text>
                      <Text className="text-slate-500 text-xs">
                        {log.ipAddress} • {formatLastActive(log.fechaAcceso)}
                      </Text>
                    </View>
                  </View>
                  {log.ubicacionEstimada && (
                    <View className="bg-white/5 px-2 py-1 rounded-md">
                      <Text className="text-slate-400 text-[10px]">{log.ubicacionEstimada}</Text>
                    </View>
                  )}
                </BlurView>
              </Animated.View>
            ))
          )}
        </View>

        {/* Danger Zone */}
        <View className="px-6">
          <TouchableOpacity className="py-4 flex-row justify-center items-center border border-red-500/30 rounded-2xl bg-red-500/5">
            <AlertTriangle size={20} color={colors.danger} />
            <Text className="text-red-400 font-bold ml-2">Reportar actividad sospechosa</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SecurityCenterScreen;

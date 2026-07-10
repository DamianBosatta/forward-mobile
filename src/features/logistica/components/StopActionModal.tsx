import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors, BRAND } from '@/libs/theme';
import { CheckCircle2, XCircle, X, ChevronDown } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

interface StopActionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (payload: { status: 'delivered' | 'failed'; observations: string; reason?: string }) => void;
  stopName: string;
  /** True while the reportarParada mutation is in flight — blocks double-submit. */
  isPending?: boolean;
}

export const StopActionModal = ({ isVisible, onClose, onConfirm, stopName, isPending = false }: StopActionModalProps) => {
  const colors = useColors();
  const [status, setStatus] = useState<'delivered' | 'failed' | null>(null);
  const [observations, setObservations] = useState('');
  const [reason, setReason] = useState('');
  const [showReasons, setShowReasons] = useState(false);

  const reasons = [
    'Negocio Cerrado',
    'Dirección Incorrecta',
    'Cliente Rechazó Pedido',
    'No hay nadie para recibir',
    'Falta de Pago',
    'Otro',
  ];

  const handleConfirm = () => {
    if (!status || isPending) return;
    onConfirm({
      status,
      observations,
      reason: status === 'failed' ? reason : undefined
    });
    // Reset local state
    setStatus(null);
    setObservations('');
    setReason('');
    setShowReasons(false);
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View 
          entering={FadeIn} 
          exiting={FadeOut}
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 24,
            paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            maxHeight: '90%'
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '900', color: colors.primary, letterSpacing: 1.2, marginBottom: 4 }}>REPORTE DE PARADA</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>{stopName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: colors.surface2, padding: 8, borderRadius: 12 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginBottom: 12 }}>RESULTADO DE LA ENTREGA</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
              <TouchableOpacity 
                onPress={() => setStatus('delivered')}
                style={{ 
                  flex: 1, padding: 16, borderRadius: 20, 
                  backgroundColor: status === 'delivered' ? BRAND.green + '20' : colors.surface2,
                  borderWidth: 2, borderColor: status === 'delivered' ? BRAND.green : 'transparent',
                  alignItems: 'center', gap: 8
                }}
              >
                <CheckCircle2 size={24} color={status === 'delivered' ? BRAND.green : colors.textDisabled} />
                <Text style={{ fontWeight: '900', color: status === 'delivered' ? BRAND.green : colors.textMuted }}>ENTREGADO</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setStatus('failed')}
                style={{ 
                  flex: 1, padding: 16, borderRadius: 20, 
                  backgroundColor: status === 'failed' ? BRAND.red + '20' : colors.surface2,
                  borderWidth: 2, borderColor: status === 'failed' ? BRAND.red : 'transparent',
                  alignItems: 'center', gap: 8
                }}
              >
                <XCircle size={24} color={status === 'failed' ? BRAND.red : colors.textDisabled} />
                <Text style={{ fontWeight: '900', color: status === 'failed' ? BRAND.red : colors.textMuted }}>FALLIDO</Text>
              </TouchableOpacity>
            </View>

            {status === 'failed' && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginBottom: 12 }}>MOTIVO DEL FALLO</Text>
                <TouchableOpacity 
                  onPress={() => setShowReasons(!showReasons)}
                  style={{ 
                    padding: 16, backgroundColor: colors.surface2, borderRadius: 16,
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <Text style={{ color: reason ? colors.text : colors.textMuted, fontWeight: '600' }}>
                    {reason || 'Seleccionar motivo...'}
                  </Text>
                  <ChevronDown size={20} color={colors.textMuted} />
                </TouchableOpacity>

                {showReasons && (
                  <View style={{ marginTop: 8, backgroundColor: colors.surface2, borderRadius: 16, overflow: 'hidden' }}>
                    {reasons.map((r) => (
                      <TouchableOpacity 
                        key={r}
                        onPress={() => { setReason(r); setShowReasons(false); }}
                        style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      >
                        <Text style={{ color: colors.text }}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginBottom: 12 }}>OBSERVACIONES</Text>
            <TextInput
              multiline
              numberOfLines={4}
              placeholder="Agregar detalles adicionales..."
              placeholderTextColor={colors.textDisabled}
              value={observations}
              onChangeText={setObservations}
              style={{
                backgroundColor: colors.surface2,
                borderRadius: 16,
                padding: 16,
                color: colors.text,
                fontSize: 16,
                minHeight: 100,
                textAlignVertical: 'top'
              }}
            />
          </ScrollView>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!status || (status === 'failed' && !reason) || isPending}
            style={{
              backgroundColor: !status ? colors.surface3 : (status === 'delivered' ? BRAND.green : BRAND.red),
              padding: 18, borderRadius: 20,
              flexDirection: 'row', justifyContent: 'center',
              alignItems: 'center', gap: 10, marginTop: 24,
              opacity: (!status || (status === 'failed' && !reason) || isPending) ? 0.5 : 1
            }}
          >
            {isPending && <ActivityIndicator size="small" color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
              {isPending ? 'ENVIANDO...' : 'CONFIRMAR REPORTE'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native'
import { GlassCard, AnimatedListItem, ForwardLogo } from '@/core/ui'
import { Truck, Package, DollarSign, ShoppingCart, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView, MotiText } from 'moti'
import { safeHaptics } from '@/core/utils/haptics'
const steps = [
  { id: 'purchase', title: 'Compra Grande', icon: Truck, description: 'Generar orden de compra masiva al proveedor.' },
  { id: 'stock', title: 'Stock Virtual', icon: Package, description: 'Validar incremento en depósitos y disponibilidad.' },
  { id: 'payment', title: 'Pago Proveedor', icon: DollarSign, description: 'Transferencia de fondos y cancelación de deuda.' },
  { id: 'sale', title: 'Venta Ciclo', icon: ShoppingCart, description: 'Crear venta, empacar y realizar la entrega.' },
  { id: 'debt', title: 'Deuda Cliente', icon: CheckCircle2, description: 'Verificar saldo en cuenta corriente del cliente.' },
]

export const StressTestWizard = () => {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const [currentStep, setCurrentStep] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])
  }

  const runStep = async () => {
    safeHaptics.impact('medium')
    setIsRunning(true)
    const step = steps[currentStep]
    addLog(`Iniciando fase: ${step.title}...`)
    
    // Simular llamada a API (aquí irían las llamadas reales a los handlers)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    addLog(`Fase ${step.title} completada con éxito.`)
    setIsRunning(false)
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      safeHaptics.notification('success')
      addLog('>>> Stress Test de Ciclo Completo FINALIZADO.')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView 
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 40, alignItems: 'center' }}>
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <ForwardLogo size={32} showText={false} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -1 }}>STRESS TEST WIZARD</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 }}>FLUJO DE NEGOCIO E2E</Text>
        </View>

        {/* ── Progress Tracker ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 }}>
          {steps.map((s, idx) => (
            <View key={s.id} style={{ alignItems: 'center', flex: 1 }}>
              <MotiView
                animate={{ 
                  backgroundColor: idx <= currentStep ? colors.primary : colors.surface2,
                  scale: idx === currentStep ? 1.2 : 1
                }}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
              >
                {idx < currentStep ? (
                  <CheckCircle2 size={16} color="#fff" />
                ) : (
                  <Text style={{ color: idx === currentStep ? '#fff' : colors.textDisabled, fontSize: 12, fontWeight: '900' }}>{idx + 1}</Text>
                )}
              </MotiView>
              {idx < steps.length - 1 && (
                <View style={{ 
                  position: 'absolute', left: '60%', top: 16, width: '80%', height: 2, 
                  backgroundColor: idx < currentStep ? colors.primary : colors.surface2 
                }} />
              )}
            </View>
          ))}
        </View>

        {/* ── Current Step Card ── */}
        <GlassCard intensity={20} style={{ padding: 32, marginBottom: 24 }}>
          <View style={{ alignItems: 'center' }}>
            <MotiView
              from={{ scale: 0.5, rotate: '0deg' }}
              animate={{ scale: 1, rotate: '0deg' }}
              transition={{ type: 'spring' }}
              style={{ width: 80, height: 80, borderRadius: 30, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}
            >
              {React.createElement(steps[currentStep].icon, { size: 40, color: colors.primary })}
            </MotiView>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' }}>{steps[currentStep].title}</Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
              {steps[currentStep].description}
            </Text>

            <TouchableOpacity
              onPress={runStep}
              disabled={isRunning}
              style={{ 
                marginTop: 40, 
                backgroundColor: colors.primary, 
                paddingVertical: 18, 
                paddingHorizontal: 40, 
                borderRadius: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                justifyContent: 'center'
              }}
            >
              {isRunning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>EJECUTAR FASE</Text>
                  <ArrowRight size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* ── Live Logs ── */}
        <View>
          <Text style={{ color: colors.textDisabled, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, marginLeft: 4 }}>
            REGISTRO DE OPERACIONES
          </Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20, minHeight: 200, borderWidth: 1, borderColor: colors.border }}>
            {logs.length === 0 ? (
              <Text style={{ color: colors.textDisabled, fontStyle: 'italic', fontSize: 12 }}>Esperando inicio de prueba...</Text>
            ) : (
              logs.map((log, i) => (
                <Text key={i} style={{ color: colors.text, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 6 }}>
                  {log}
                </Text>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

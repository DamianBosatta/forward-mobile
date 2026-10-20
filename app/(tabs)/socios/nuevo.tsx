import React, { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { Check, Lock } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, TopBar } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useClienteForm } from '@/features/clientes/hooks/useClienteForm'
import { AVISO_CONDICION_PAGO } from '@/features/clientes/components/FichaCliente'
import { textoCondicionPago, type TipoCondicionPago } from '@/features/clientes/lib/cliente'

const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final']
const TIPOS_PAGO: { value: TipoCondicionPago; label: string }[] = [
  { value: 'Contado', label: 'Contado' },
  { value: 'DiasDesdeEntrega', label: 'Días desde la entrega' },
  { value: 'DiasDesdeFactura', label: 'Días desde la factura' },
  { value: 'DiaFijoDelMes', label: 'Día fijo del mes' },
]

function Opciones<T extends string>({ titulo, opciones, valor, onChange }: {
  titulo: string; opciones: { value: T; label: string }[]; valor: T; onChange: (v: T) => void
}) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.text }}>{titulo}</Text>
      {opciones.map(op => {
        const elegido = op.value === valor
        return (
          <Pressable
            key={op.value}
            accessibilityRole="radio"
            accessibilityLabel={op.label}
            accessibilityState={{ checked: elegido, selected: elegido }}
            onPress={() => onChange(op.value)}
            style={{
              minHeight: 48, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radii.campo,
              borderWidth: elegido ? 2 : 1, borderColor: elegido ? c.brand : c.border,
              backgroundColor: elegido ? c.brandSoft : c.surface,
            }}
          >
            <Text style={{ ...(elegido ? typeScale.cuerpoDestacado : typeScale.cuerpo), color: c.text }}>{op.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export const AYUDA_PROVISORIA = 'Para no perder la venta: el CUIT y los datos que falten se completan después. Mientras tanto el cliente queda provisorio.'
export const AVISO_CAMPOS_SENSIBLES = 'La dirección, la razón social y el CUIT los cambia un administrador: pedilo con «Pedir cambio» en la ficha del cliente.'

function Casilla({ label, ayuda, valor, onChange }: { label: string; ayuda: string; valor: boolean; onChange: (v: boolean) => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={ayuda}
      accessibilityState={{ checked: valor }}
      onPress={() => onChange(!valor)}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3] }}
    >
      <View style={{ width: 24, height: 24, borderRadius: radii.campo, borderWidth: 2, borderColor: valor ? c.brand : c.border, backgroundColor: valor ? c.brandSoft : c.surface, alignItems: 'center', justifyContent: 'center' }}>
        {valor ? <Check size={16} color={c.brandInk} /> : null}
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{label}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{ayuda}</Text>
      </View>
    </Pressable>
  )
}

function ClienteForm({ id }: { id?: string }) {
  const c = useColors()
  const router = useRouter()
  const alGuardar = (nuevoId: string) => router.replace({ pathname: '/(tabs)/socios/[id]', params: { id: nuevoId } })
  const { datos, cambiar, guardar, error, editando, puedeCambiarPago, cargando, guardando, errorDeCarga, reintentar } = useClienteForm(id, alGuardar)
  const { hasCapability } = usePermissions()
  // Los campos sensibles los edita directo quien aprueba cambios de socio (UpdateSocioCommandHandler).
  const editaSensibles = hasCapability('CAP_APROBAR_CAMBIOS_SOCIO')

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={editando ? 'Editar cliente' : 'Nuevo cliente'} leading={{ kind: 'atras', onPress: () => router.back() }} />
      {errorDeCarga ? (
        <View style={{ padding: space[4], gap: space[4], width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <Notice tone="peligro">{errorDeCarga}</Notice>
          <Button label="Reintentar" onPress={reintentar} />
        </View>
      ) : cargando ? (
        <ActivityIndicator color={c.brandInk} style={{ marginTop: space[8] }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], width: '100%', maxWidth: 640, alignSelf: 'center' }}>
            {editando && !editaSensibles ? <Notice tone="info">{AVISO_CAMPOS_SENSIBLES}</Notice> : null}
            {!editando ? (
              <Casilla label="Alta provisoria" ayuda={AYUDA_PROVISORIA} valor={datos.altaProvisoria} onChange={v => cambiar('altaProvisoria', v)} />
            ) : null}
            <Field label="Dirección de entrega" value={datos.direccion} onChangeText={v => cambiar('direccion', v)} help="Identifica al cliente: es donde se entrega." />
            <Field label="Nombre del local" value={datos.nombreFantasia} onChangeText={v => cambiar('nombreFantasia', v)} />
            <Field label="Contacto" value={datos.nombreContacto} onChangeText={v => cambiar('nombreContacto', v)} help="A quién preguntar al llegar." />
            <Field label="Teléfono" value={datos.telefono} onChangeText={v => cambiar('telefono', v)} keyboardType="phone-pad" />
            <Field label="Razón social" value={datos.razonSocial} onChangeText={v => cambiar('razonSocial', v)} />
            <Field label="CUIT" value={datos.cuit} onChangeText={v => cambiar('cuit', v)} keyboardType="number-pad" />
            <Opciones
              titulo="Condición frente al IVA"
              opciones={CONDICIONES_IVA.map(v => ({ value: v, label: v }))}
              valor={datos.condicionIva}
              onChange={v => cambiar('condicionIva', v)}
            />
            <Field label="Email" value={datos.email} onChangeText={v => cambiar('email', v)} keyboardType="email-address" autoCapitalize="none" />

            {puedeCambiarPago ? (
              <>
                <Opciones titulo="Condición de pago" opciones={TIPOS_PAGO} valor={datos.tipoPago} onChange={v => cambiar('tipoPago', v)} />
                {datos.tipoPago !== 'Contado' ? (
                  <Field
                    label={datos.tipoPago === 'DiaFijoDelMes' ? 'Día del mes' : 'Días'}
                    value={datos.plazo}
                    onChangeText={v => cambiar('plazo', v.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                  />
                ) : null}
                <Field label="Tope de crédito" value={datos.tope} onChangeText={v => cambiar('tope', v)} keyboardType="decimal-pad" help="En pesos. Vacío: sin tope." />
              </>
            ) : (
              <View accessible accessibilityLabel={`Condición de pago: ${textoCondicionPago({ tipo: datos.tipoPago })}. ${AVISO_CONDICION_PAGO}`} style={{ gap: space[1] }}>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Condición de pago</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Lock size={16} color={c.textSecondary} />
                  <Text style={{ ...typeScale.cuerpo, color: c.text }}>{textoCondicionPago({ tipo: datos.tipoPago, dias: Number(datos.plazo) || null, diaDelMes: Number(datos.plazo) || null })}</Text>
                </View>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{AVISO_CONDICION_PAGO}</Text>
              </View>
            )}

            {error ? <Notice tone="peligro">{error}</Notice> : null}
            <Button label={editando ? 'Guardar cambios' : 'Crear cliente'} onPress={guardar} loading={guardando} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

/** Alta y edición de cliente. Se rearma en cada visita: el menú lateral deja la pantalla montada. */
export default function ClienteFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const [visita, setVisita] = useState(0)
  // La primera vez ya se montó limpio: rearmar de nuevo descartaría lo que se alcance a tipear.
  const primera = useRef(true)
  useFocusEffect(useCallback(() => {
    if (primera.current) { primera.current = false; return }
    setVisita(v => v + 1)
  }, []))
  return <ClienteForm key={`${id ?? 'nuevo'}-${visita}`} id={id || undefined} />
}

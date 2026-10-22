import React from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { space, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TopBar } from '@/core/ui/fw'
import { CampoDeSocio } from '@/features/socios/components/CampoDeSocio'
import { OpcionesRadio } from '@/features/socios/components/OpcionesRadio'
import { PieDeFormulario } from '@/features/socios/components/PieDeFormulario'
import { CONDICIONES_IVA, TIPOS_PAGO } from '@/features/clientes/lib/cliente'
import { useProveedorForm } from '../hooks/useProveedorForm'
import { AVISO_CAMPOS_SENSIBLES_PROVEEDOR, AVISO_EDICION_PROVEEDOR } from '../lib/proveedor'

/** Alta (`id` ausente) y edición de un proveedor (láminas Nuevo proveedor y Editar proveedor). */
export function ProveedorForm({ id }: { id?: string }) {
  const c = useColors()
  const router = useRouter()
  const alGuardar = (nuevoId: string) => router.replace({ pathname: '/(tabs)/proveedores/[id]', params: { id: nuevoId } })
  const { datos, cambiar, guardar, error, editando, bloqueo, cargando, guardando, errorDeCarga, reintentar, guardado } = useProveedorForm(id, alGuardar)
  const hayBloqueo = bloqueo.razonSocial || bloqueo.cuit

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={editando ? 'Editar proveedor' : 'Nuevo proveedor'}
        subtitle={editando ? guardado?.razonSocial?.trim() || undefined : undefined}
        leading={{ kind: 'atras', onPress: () => router.back() }}
      />
      {errorDeCarga ? (
        <FormContainer style={{ padding: space[4], gap: space[4] }}>
          <Notice tone="peligro">{errorDeCarga}</Notice>
          <Button label="Reintentar" onPress={reintentar} />
        </FormContainer>
      ) : cargando ? (
        <ActivityIndicator color={c.brandInk} style={{ marginTop: space[8] }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ paddingVertical: space[4] }}>
            <FormContainer style={{ paddingHorizontal: space[4], gap: space[4] }}>
              {hayBloqueo ? <Notice tone="info">{AVISO_CAMPOS_SENSIBLES_PROVEEDOR}</Notice> : null}
              <CampoDeSocio label="Razón social" value={datos.razonSocial} onChangeText={v => cambiar('razonSocial', v)} bloqueado={bloqueo.razonSocial} placeholder="Como figura en ARCA" />
              <CampoDeSocio label="CUIT" value={datos.cuit} onChangeText={v => cambiar('cuit', v)} bloqueado={bloqueo.cuit} keyboardType="number-pad" placeholder="30-12345678-9" />
              <OpcionesRadio
                titulo="Condición frente al IVA"
                opciones={CONDICIONES_IVA.map(v => ({ value: v, label: v }))}
                valor={datos.condicionIva}
                onChange={v => cambiar('condicionIva', v)}
              />
              <CampoDeSocio label="Teléfono" value={datos.telefono} onChangeText={v => cambiar('telefono', v)} keyboardType="phone-pad" placeholder="11 4555-0000" />
              <OpcionesRadio titulo="Condición de pago (obligatoria para comprarle)" opciones={TIPOS_PAGO} valor={datos.tipoPago} onChange={v => cambiar('tipoPago', v)} />
              {datos.tipoPago !== 'Contado' ? (
                <CampoDeSocio
                  label={datos.tipoPago === 'DiaFijoDelMes' ? 'Día del mes' : 'Días'}
                  value={datos.plazo}
                  onChangeText={v => cambiar('plazo', v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />
              ) : null}
              {editando ? <Notice tone="info">{AVISO_EDICION_PROVEEDOR}</Notice> : null}
              {error ? <Notice tone="peligro">{error}</Notice> : null}
            </FormContainer>
          </ScrollView>
          <PieDeFormulario>
            <FormContainer>
              <Button label={editando ? 'Guardar cambios' : 'Guardar proveedor'} onPress={guardar} loading={guardando} />
            </FormContainer>
          </PieDeFormulario>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

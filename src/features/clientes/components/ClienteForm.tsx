import React from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Info, Lock } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TopBar } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CampoDeSocio } from '@/features/socios/components/CampoDeSocio'
import { CasillaDeSocio } from '@/features/socios/components/CasillaDeSocio'
import { OpcionesRadio } from '@/features/socios/components/OpcionesRadio'
import { PieDeFormulario } from '@/features/socios/components/PieDeFormulario'
import { sensiblesBloqueados } from '@/features/socios/lib/camposSensibles'
import { useClienteForm } from '../hooks/useClienteForm'
import { AVISO_CONDICION_PAGO } from './FichaCliente'
import { CONDICIONES_IVA, TIPOS_PAGO, textoCondicionPago } from '../lib/cliente'


export const AYUDA_PROVISORIA = 'Para no perder la venta: el CUIT y los datos que falten se completan después. Mientras tanto el cliente queda provisorio.'
export const AVISO_CAMPOS_SENSIBLES = 'La dirección, la razón social y el CUIT los cambia un administrador: pedilo con «Pedir cambio» en la ficha del cliente.'
export const AVISO_ALTA = 'Queda en tu cartera. El tope de crédito y la condición de pago los define quien autoriza ventas.'
export const AVISO_EDICION = 'Solo podés editar clientes de tu cartera. El crédito y la condición de pago los cambia quien autoriza ventas. No se dan de baja desde la app.'

/** Alta (`id` ausente) y edición de un cliente (láminas Nuevo cliente, Editar cliente y TabNuevoCliente). */
export function ClienteForm({ id }: { id?: string }) {
  const c = useColors()
  const router = useRouter()
  const alGuardar = (nuevoId: string) => router.replace({ pathname: '/(tabs)/socios/[id]', params: { id: nuevoId } })
  const { datos, cambiar, guardar, error, editando, puedeCambiarPago, cargando, guardando, errorDeCarga, reintentar, guardado } = useClienteForm(id, alGuardar)
  // Misma regla que la web: dirección, razón social y CUIT los edita directo solo un administrador.
  const esAdmin = useAuthStore(s => s.isAdmin())
  const bloqueo = sensiblesBloqueados(esAdmin, editando, guardado)
  const hayBloqueo = bloqueo.razonSocial || bloqueo.cuit || bloqueo.direccion

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={editando ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle={editando ? guardado?.direccion?.trim() || undefined : undefined}
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
              {hayBloqueo ? <Notice tone="info">{AVISO_CAMPOS_SENSIBLES}</Notice> : null}
              {!editando ? (
                <CasillaDeSocio label="Alta provisoria" ayuda={AYUDA_PROVISORIA} valor={datos.altaProvisoria} onChange={v => cambiar('altaProvisoria', v)} />
              ) : null}
              <CampoDeSocio label="Dirección de entrega" value={datos.direccion} onChangeText={v => cambiar('direccion', v)} bloqueado={bloqueo.direccion} help="Es como lo van a encontrar los vendedores y el chofer." />
              <CampoDeSocio label="Nombre del local" value={datos.nombreFantasia} onChangeText={v => cambiar('nombreFantasia', v)} />
              <CampoDeSocio label="CUIT" value={datos.cuit} onChangeText={v => cambiar('cuit', v)} bloqueado={bloqueo.cuit} keyboardType="number-pad" placeholder="20-12345678-9" />
              <OpcionesRadio
                titulo="Condición frente al IVA"
                opciones={CONDICIONES_IVA.map(v => ({ value: v, label: v }))}
                valor={datos.condicionIva}
                onChange={v => cambiar('condicionIva', v)}
              />
              <CampoDeSocio label="Razón social" value={datos.razonSocial} onChangeText={v => cambiar('razonSocial', v)} bloqueado={bloqueo.razonSocial} placeholder="Como figura en ARCA" />
              <CampoDeSocio label="Contacto" value={datos.nombreContacto} onChangeText={v => cambiar('nombreContacto', v)} help="A quién preguntar al llegar." />
              <CampoDeSocio label="Teléfono" value={datos.telefono} onChangeText={v => cambiar('telefono', v)} keyboardType="phone-pad" placeholder="221 555-0123" />
              <CampoDeSocio label="Email" value={datos.email} onChangeText={v => cambiar('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="opcional" />

              {puedeCambiarPago ? (
                <>
                  <OpcionesRadio titulo="Condición de pago" opciones={TIPOS_PAGO} valor={datos.tipoPago} onChange={v => cambiar('tipoPago', v)} />
                  {datos.tipoPago !== 'Contado' ? (
                    <CampoDeSocio
                      label={datos.tipoPago === 'DiaFijoDelMes' ? 'Día del mes' : 'Días'}
                      value={datos.plazo}
                      onChangeText={v => cambiar('plazo', v.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                    />
                  ) : null}
                  <CampoDeSocio label="Tope de crédito" value={datos.tope} onChangeText={v => cambiar('tope', v)} keyboardType="decimal-pad" help="En pesos. Vacío: sin tope." />
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

              <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                <Info size={18} color={c.textSecondary} />
                <Text style={{ ...typeScale.secundario, color: c.textSecondary, flex: 1 }}>{editando ? AVISO_EDICION : AVISO_ALTA}</Text>
              </View>
              {error ? <Notice tone="peligro">{error}</Notice> : null}
            </FormContainer>
          </ScrollView>
          <PieDeFormulario>
            <FormContainer>
              <Button label={editando ? 'Guardar cambios' : 'Crear cliente'} onPress={guardar} loading={guardando} />
            </FormContainer>
          </PieDeFormulario>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

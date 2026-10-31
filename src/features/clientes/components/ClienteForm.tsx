import React, { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Crosshair, Lock } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { cuitDigitosFaltantes, cuitEsValido } from '@/libs/reglas'
import { Button, FormContainer, Notice, TopBar } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { CampoDeSocio } from '@/features/socios/components/CampoDeSocio'
import { CasillaDeSocio } from '@/features/socios/components/CasillaDeSocio'
import { OpcionesRadio } from '@/features/socios/components/OpcionesRadio'
import { PieDeFormulario } from '@/features/socios/components/PieDeFormulario'
import { sensiblesBloqueados } from '@/features/socios/lib/camposSensibles'
import { useClienteForm } from '../hooks/useClienteForm'
import { ERROR_UBICACION, direccionDeMiUbicacion } from '../lib/ubicacion'
import { AVISO_CONDICION_PAGO } from './FichaCliente'
import { CONDICIONES_IVA, TIPOS_PAGO, textoCondicionPago } from '../lib/cliente'


export const AYUDA_PROVISORIA = 'Para no perder la venta: el CUIT y los datos que falten se completan después. Mientras tanto el cliente queda provisorio.'
export const AVISO_CAMPOS_SENSIBLES = 'La dirección, la razón social y el CUIT los cambia un administrador: pedilo con «Pedir cambio» en la ficha del cliente.'
export const ERROR_CUIT = 'Revisá el CUIT: no es válido.'
export const AYUDA_CUIT_VACIO = 'Si todavía no lo tenés, dejalo vacío y guardalo como alta provisoria.'
/** "El CUIT tiene 11 dígitos: faltan N" (lámina); la cuenta sale de `cuitDigitosFaltantes` de @forward/reglas. */
export const avisoCuitIncompleto = (faltan: number) => `El CUIT tiene 11 dígitos: ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`}`
export const AVISO_ALTA = 'Queda en tu cartera. El tope de crédito y la condición de pago los define gestión.'
export const AVISO_EDICION = 'Solo podés editar clientes de tu cartera. El crédito y la condición de pago los cambia quien autoriza ventas. No se dan de baja desde la app.'

/** Encabezado de un grupo de campos (Entrega, Datos fiscales, Contacto, Cómo paga). */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ gap: space[4] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{titulo}</Text>
      {children}
    </View>
  )
}

/** Alta (`id` ausente) y edición de un cliente (láminas Nuevo cliente, Editar cliente y TabNuevoCliente). */
export function ClienteForm({ id }: { id?: string }) {
  const c = useColors()
  const router = useRouter()
  // "Guardar y vender" sigue de largo a la venta nueva con el cliente recién creado (la pantalla lee `clienteId`).
  const alGuardar = (nuevoId: string, destino: 'ficha' | 'vender') =>
    destino === 'vender'
      ? router.replace({ pathname: '/(tabs)/ventas/nueva', params: { clienteId: nuevoId } })
      : router.replace({ pathname: '/(tabs)/socios/[id]', params: { id: nuevoId } })
  const { datos, cambiar, guardar, error, editando, puedeCambiarPago, cargando, guardando, errorDeCarga, reintentar, guardado } = useClienteForm(id, alGuardar)
  // Misma regla que la web: dirección, razón social y CUIT los edita directo solo un administrador.
  const esAdmin = useAuthStore(s => s.isAdmin())
  const bloqueo = sensiblesBloqueados(esAdmin, editando, guardado)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState(false)
  const usarMiUbicacion = async () => {
    setBuscandoUbicacion(true)
    setErrorUbicacion(false)
    const direccion = await direccionDeMiUbicacion()
    setBuscandoUbicacion(false)
    if (direccion) cambiar('direccion', direccion)
    else setErrorUbicacion(true)
  }
  // Aviso previo en el teléfono, con la regla de @forward/reglas; no frena el guardado: el servidor decide.
  const cuitInvalido = !bloqueo.cuit && datos.cuit.trim() !== '' && !cuitEsValido(datos.cuit)
  const cuitFaltan = cuitInvalido ? cuitDigitosFaltantes(datos.cuit) : 0
  const hayBloqueo = bloqueo.razonSocial || bloqueo.cuit || bloqueo.direccion

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={editando ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle={editando ? guardado?.direccion?.trim() || undefined : datos.altaProvisoria ? 'Alta provisoria' : undefined}
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
              <Grupo titulo="Entrega">
                <View>
                  <CampoDeSocio label="Dirección de entrega" value={datos.direccion} onChangeText={v => cambiar('direccion', v)} bloqueado={bloqueo.direccion} help="Es como lo van a encontrar los vendedores y el chofer." />
                  {!bloqueo.direccion ? (
                    // La mira va dentro del campo (lámina clientes-nuevo): a la altura de la caja, sin la etiqueta.
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Usar mi ubicación"
                      disabled={buscandoUbicacion}
                      onPress={() => { void usarMiUbicacion() }}
                      style={{ position: 'absolute', right: 0, top: space[6], width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: buscandoUbicacion ? 0.5 : 1 }}
                    >
                      <Crosshair size={22} color={c.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
                {errorUbicacion ? <Notice tone="advertencia">{ERROR_UBICACION}</Notice> : null}
                <CampoDeSocio label="Nombre del local" value={datos.nombreFantasia} onChangeText={v => cambiar('nombreFantasia', v)} />
              </Grupo>

              <Grupo titulo="Datos fiscales">
                {!editando ? (
                  <CasillaDeSocio label="Alta provisoria" ayuda={AYUDA_PROVISORIA} valor={datos.altaProvisoria} onChange={v => cambiar('altaProvisoria', v)} />
                ) : null}
                <View style={{ gap: space[1] }}>
                  <CampoDeSocio
                    label="CUIT"
                    value={datos.cuit}
                    onChangeText={v => cambiar('cuit', v)}
                    bloqueado={bloqueo.cuit}
                    keyboardType="number-pad"
                    placeholder="20-12345678-9"
                    error={cuitInvalido ? ERROR_CUIT : undefined}
                  />
                  {cuitFaltan > 0 ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{avisoCuitIncompleto(cuitFaltan)}</Text> : null}
                  {cuitInvalido ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{AYUDA_CUIT_VACIO}</Text> : null}
                </View>
                <OpcionesRadio
                  titulo="Condición frente al IVA"
                  opciones={CONDICIONES_IVA.map(v => ({ value: v, label: v }))}
                  valor={datos.condicionIva}
                  onChange={v => cambiar('condicionIva', v)}
                />
                <CampoDeSocio label="Razón social" value={datos.razonSocial} onChangeText={v => cambiar('razonSocial', v)} bloqueado={bloqueo.razonSocial} placeholder="Como figura en ARCA" />
              </Grupo>

              <Grupo titulo="Contacto">
                <CampoDeSocio label="Contacto" value={datos.nombreContacto} onChangeText={v => cambiar('nombreContacto', v)} help="A quién preguntar al llegar." />
                <CampoDeSocio label="Teléfono" value={datos.telefono} onChangeText={v => cambiar('telefono', v)} keyboardType="phone-pad" placeholder="221 555-0123" />
                <CampoDeSocio label="Email" value={datos.email} onChangeText={v => cambiar('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="opcional" />
              </Grupo>

              <Grupo titulo="Cómo paga">
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
              </Grupo>

              <Notice tone="info">{editando ? AVISO_EDICION : AVISO_ALTA}</Notice>
              {error ? <Notice tone="peligro">{error}</Notice> : null}
            </FormContainer>
          </ScrollView>
          <PieDeFormulario>
            <FormContainer>
              {editando ? (
                <Button label="Guardar cambios" onPress={() => { void guardar() }} loading={guardando} />
              ) : (
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <View style={{ flex: 1 }}><Button label="Guardar" variant="secundario" onPress={() => { void guardar() }} disabled={guardando} /></View>
                  <View style={{ flex: 1 }}><Button label="Guardar y vender" onPress={() => { void guardar('vender') }} loading={guardando} /></View>
                </View>
              )}
            </FormContainer>
          </PieDeFormulario>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

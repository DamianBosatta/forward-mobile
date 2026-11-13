import React, { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Crosshair } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { cuitDigitosFaltantes, cuitEsValido } from '@/libs/reglas'
import { Button, FormContainer, Notice, TopBar } from '@/core/ui/fw'
import { CampoDeSocio } from '@/features/socios/components/CampoDeSocio'
import { InterruptorDeSocio } from '@/features/socios/components/InterruptorDeSocio'
import { FilaBloqueada } from '@/features/socios/components/FilaBloqueada'
import { OpcionesRadio } from '@/features/socios/components/OpcionesRadio'
import { PieDeFormulario } from '@/features/socios/components/PieDeFormulario'
import { useClienteForm } from '../hooks/useClienteForm'
import { ERROR_UBICACION, direccionDeMiUbicacion } from '../lib/ubicacion'
import { HorarioEntregaEditor } from './HorarioEntregaEditor'
import { Esqueletos, FORMULARIO_CARGANDO } from './Esqueletos'
import { CondicionesPagoClienteEditor } from './CondicionesPagoClienteEditor'
import { GestionDelCliente } from './GestionDelCliente'
import { CONDICIONES_IVA } from '../lib/cliente'


export const AYUDA_PROVISORIA = 'Para no perder la venta: el CUIT y los datos que falten se completan después. Mientras tanto el cliente queda provisorio.'
export const AVISO_CAMPOS_SENSIBLES = 'La dirección, la razón social y el CUIT los cambia un administrador: pedilo con «Pedir cambio» en la ficha del cliente.'
export const ERROR_CUIT = 'Revisá el CUIT: no es válido.'
export const AYUDA_CUIT_VACIO = 'Si todavía no lo tenés, dejalo vacío y guardalo como alta provisoria.'
/** "El CUIT tiene 11 dígitos: faltan N" (lámina); la cuenta sale de `cuitDigitosFaltantes` de @forward/reglas. */
export const avisoCuitIncompleto = (faltan: number) => `El CUIT tiene 11 dígitos: ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`}`
export const AVISO_ALTA = 'Queda en tu cartera. El tope de crédito lo define quien autoriza ventas.'
export const AVISO_EDICION = 'Solo podés editar clientes de tu cartera. El tope de crédito y las condiciones de pago los cambia quien autoriza ventas. No se dan de baja desde la app.'

/** Un grupo de campos (Entrega, Datos fiscales, Contacto, Cómo paga) en una tarjeta sin borde (propuesta, frames 15-17). */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View testID={`grupo-${titulo}`} style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[4] }}>
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
  const { datos, cambiar, guardar, error, errores, erroresCondiciones, intentoGuardar, editando, puedeCambiarPago, puedeSaldoInicial, puedeEditarCondiciones, bloqueo, cargando, guardando, errorDeCarga, reintentar, guardado } = useClienteForm(id, alGuardar)
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
  const errorCuit = cuitInvalido ? ERROR_CUIT : errores.cuit
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
        // Mientras carga no se muestra el formulario: esqueletos con la forma de las tarjetas (frame 20).
        <FormContainer style={{ padding: space[4] }}>
          <Esqueletos bloques={FORMULARIO_CARGANDO} />
        </FormContainer>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingVertical: space[4] }} keyboardShouldPersistTaps="handled">
            <FormContainer style={{ paddingHorizontal: space[4], gap: space[4] }}>
              {hayBloqueo ? (
                // Lo que este usuario no cambia: filas bloqueadas en una tarjeta propia con el aviso (frame 19).
                <View testID="campos-bloqueados" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
                  <Notice tone="info">{AVISO_CAMPOS_SENSIBLES}</Notice>
                  {bloqueo.direccion ? <FilaBloqueada etiqueta="Dirección de entrega" valor={datos.direccion.trim() || '—'} /> : null}
                  {bloqueo.cuit ? <FilaBloqueada etiqueta="CUIT" valor={datos.cuit.trim() || '—'} /> : null}
                  {bloqueo.razonSocial ? <FilaBloqueada etiqueta="Razón social" valor={datos.razonSocial.trim() || '—'} /> : null}
                </View>
              ) : null}
              <Grupo titulo="Entrega">
                {!bloqueo.direccion ? (
                  <View>
                    <CampoDeSocio label="Dirección de entrega" value={datos.direccion} onChangeText={v => cambiar('direccion', v)} help="Es como lo van a encontrar los vendedores y el chofer." error={errores.direccion} />
                    {/* La mira va dentro del campo (lámina clientes-nuevo): a la altura de la caja, sin la etiqueta. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Usar mi ubicación"
                      disabled={buscandoUbicacion}
                      onPress={() => { void usarMiUbicacion() }}
                      style={{ position: 'absolute', right: 0, top: space[6], width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: buscandoUbicacion ? 0.5 : 1 }}
                    >
                      <Crosshair size={22} color={c.textSecondary} />
                    </Pressable>
                  </View>
                ) : null}
                {errorUbicacion ? <Notice tone="advertencia">{ERROR_UBICACION}</Notice> : null}
                <CampoDeSocio label="Nombre del local" value={datos.nombreFantasia} onChangeText={v => cambiar('nombreFantasia', v)} error={errores.nombreFantasia} />
                <CampoDeSocio label="Localidad (para armar el recorrido)" value={datos.localidad} onChangeText={v => cambiar('localidad', v)} placeholder="Barrio o localidad" />
              </Grupo>

              <Grupo titulo="Horario de atención">
                <HorarioEntregaEditor filas={datos.horario} onChange={v => cambiar('horario', v)} mostrarErrores={intentoGuardar} />
              </Grupo>

              <Grupo titulo="Datos fiscales">
                {!editando ? (
                  <InterruptorDeSocio label="Alta provisoria" ayuda={AYUDA_PROVISORIA} valor={datos.altaProvisoria} onChange={v => cambiar('altaProvisoria', v)} />
                ) : null}
                {!bloqueo.cuit ? (
                <View style={{ gap: space[1] }}>
                  <CampoDeSocio
                    label="CUIT"
                    value={datos.cuit}
                    onChangeText={v => cambiar('cuit', v)}
                    keyboardType="number-pad"
                    placeholder="20-12345678-9"
                    error={errorCuit}
                  />
                  {cuitFaltan > 0 ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{avisoCuitIncompleto(cuitFaltan)}</Text> : null}
                  {cuitInvalido ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{AYUDA_CUIT_VACIO}</Text> : null}
                </View>
                ) : null}
                <OpcionesRadio
                  enTarjeta
                  titulo="Condición frente al IVA"
                  opciones={CONDICIONES_IVA.map(v => ({ value: v, label: v }))}
                  valor={datos.condicionIva}
                  onChange={v => cambiar('condicionIva', v)}
                />
                {!bloqueo.razonSocial ? (
                  <CampoDeSocio label="Razón social" value={datos.razonSocial} onChangeText={v => cambiar('razonSocial', v)} placeholder="Como figura en ARCA" />
                ) : null}
              </Grupo>

              <Grupo titulo="Contacto">
                <CampoDeSocio label="Contacto" value={datos.nombreContacto} onChangeText={v => cambiar('nombreContacto', v)} help="A quién preguntar al llegar." error={errores.nombreContacto} />
                <CampoDeSocio label="Teléfono" value={datos.telefono} onChangeText={v => cambiar('telefono', v)} keyboardType="phone-pad" placeholder="221 555-0123" error={errores.telefono} />
                <CampoDeSocio label="Email" value={datos.email} onChangeText={v => cambiar('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="opcional" error={errores.email} />
              </Grupo>

              <Grupo titulo="Cómo paga">
                <CondicionesPagoClienteEditor
                  filas={datos.condiciones}
                  onChange={v => cambiar('condiciones', v)}
                  soloLectura={!puedeEditarCondiciones}
                  errores={erroresCondiciones}
                />
                {puedeCambiarPago ? (
                  <CampoDeSocio label="Tope de crédito" value={datos.tope} onChangeText={v => cambiar('tope', v)} keyboardType="decimal-pad" help="En pesos. Vacío: sin tope." />
                ) : null}
                {!editando && puedeSaldoInicial ? (
                  <CampoDeSocio label="Saldo inicial" value={datos.saldoInicial} onChangeText={v => cambiar('saldoInicial', v)} keyboardType="decimal-pad" help="Lo que ya debía antes de entrar al sistema, en pesos. Vacío: sin deuda." error={errores.saldoInicial} />
                ) : null}
              </Grupo>

              {editando && guardado ? <GestionDelCliente cliente={guardado} /> : null}

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
        </View>
      )}
    </View>
  )
}

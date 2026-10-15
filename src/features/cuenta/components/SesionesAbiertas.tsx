import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Button, Notice } from '@/core/ui/fw'
import { space, typeScale, useColors } from '@/libs/theme'
import { parseDateSafe, partesArgentina } from '@/src/utils/date'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCerrarSesionAbierta, useSesiones } from '../api/cuenta'
import { DISPOSITIVO_DESCONOCIDO, nombreDeDispositivo } from '../lib/dispositivo'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dos = (n: number) => String(n).padStart(2, '0')

/** "9 oct, 07:58" en hora argentina; sin fecha válida, "—". */
export function fechaSesion(iso: string | null | undefined, conHora = true): string {
  const f = parseDateSafe(iso)
  if (!f) return '—'
  const p = partesArgentina(f.getTime())
  return `${p.dia} ${MESES[p.mes]}${conHora ? `, ${dos(p.hora)}:${dos(p.minuto)}` : ''}`
}

/**
 * Sesiones abiertas (lámina MiCuenta). Muestra lo que manda el servidor, sin estados inventados:
 * "Este dispositivo" y la última actividad solo si el servidor los da (9B, prioridad 3); la actual
 * va primero.
 */
export function SesionesAbiertas() {
  const c = useColors()
  const q = useSesiones()
  const cerrar = useCerrarSesionAbierta()
  const sesiones = [...(q.data ?? [])].sort((a, b) => Number(!!b.esActual) - Number(!!a.esActual))
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  return (
    <View style={{ gap: space[3] }}>
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>
        {q.data ? `Sesiones abiertas (${sesiones.length})` : 'Sesiones abiertas'}
      </Text>
      <Text style={secundario}>
        Dispositivos donde entraste con tu usuario y la sesión sigue vigente. Si no reconocés uno, cerralo y cambiá la contraseña. Si cerrás la de este teléfono, te va a pedir entrar de nuevo.
      </Text>
      {q.isLoading ? <ActivityIndicator color={c.brand} /> : null}
      {q.isError ? <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudieron cargar las sesiones.')}</Notice> : null}
      {cerrar.isError ? <Notice tone="peligro">{mensajeDelServidor(cerrar.error, 'No se pudo cerrar la sesión.')}</Notice> : null}
      {sesiones.map((s) => {
        const dispositivo = nombreDeDispositivo(s.device)
        const crudo = s.device?.trim()
        return (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingTop: space[3], borderTopWidth: 1, borderTopColor: c.border }}>
            <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
              <Text
                numberOfLines={2}
                accessibilityHint={crudo ? `User-Agent: ${crudo}` : undefined}
                style={[typeScale.cuerpo, { color: c.text }]}
              >
                {dispositivo}
              </Text>
              {/* Si no se reconoce, el User-Agent crudo es lo único que queda para identificarlo. */}
              {s.esActual ? <Text style={[typeScale.secundario, { color: c.brand }]}>Este dispositivo</Text> : null}
              {dispositivo === DISPOSITIVO_DESCONOCIDO && crudo ? <Text numberOfLines={1} style={secundario}>{crudo}</Text> : null}
              <Text style={secundario}>{`IP ${s.ip}`}</Text>
              <Text style={secundario}>{`Inició el ${fechaSesion(s.iniciadaEn ?? s.createdAt)} · Vence el ${fechaSesion(s.expiresAt, false)}`}</Text>
              {s.ultimaActividad ? <Text style={secundario}>{`Última actividad: ${fechaSesion(s.ultimaActividad)}`}</Text> : null}
            </View>
            <Button
              label="Cerrar"
              variant="secundario"
              accessibilityLabel={`Cerrar la sesión de ${dispositivo}`}
              loading={cerrar.isPending && cerrar.variables === s.id}
              onPress={() => cerrar.mutate(s.id)}
            />
          </View>
        )
      })}
      {q.data && sesiones.length === 0 ? <Text style={secundario}>No hay sesiones abiertas.</Text> : null}
    </View>
  )
}

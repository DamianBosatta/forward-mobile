import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Share2 } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, FiltroChip, Notice, Segmented, pesoSemibold } from '@/core/ui/fw'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { useEnLinea } from '@/features/ventas/lib/sinConexion'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'
import { diaArgentina } from '@/core/utils/fecha'
import { PERIODOS_DE_CUENTA, rangoDelPeriodo, type PeriodoDeCuenta } from '@/features/cuentas/lib/periodo'
import { urlEstadoDeCuenta, type FormatoEstadoDeCuenta } from '../api/queries'

const FORMATOS: { value: FormatoEstadoDeCuenta; label: string }[] = [
  { value: 'Pdf', label: 'PDF' },
  { value: 'Excel', label: 'Excel' },
]

const SIN_CONEXION = 'Sin conexión: el archivo se arma en el servidor. Probá cuando vuelva la señal.'

/** "estado-cuenta-graciela-ruiz-2026-11-12.pdf": sin tildes ni espacios, con el día argentino. */
export function nombreDelArchivo(razonSocial: string, formato: FormatoEstadoDeCuenta, ahoraMs: number): string {
  const slug = razonSocial
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `estado-cuenta-${slug || 'cliente'}-${diaArgentina(ahoraMs)}.${formato === 'Pdf' ? 'pdf' : 'xlsx'}`
}

interface Props {
  /** El socio del estado de cuenta; `null` cierra la hoja. */
  socio: { id: string; razonSocial: string } | null
  onClose: () => void
}

/**
 * Hoja "Estado de cuenta" (S2): el archivo de las dos cuentas del cliente, con lo que debe y lo que pagó, en PDF o
 * Excel y, si se quiere, de un período. Se descarga con la sesión y se abre el panel de compartir del sistema
 * (WhatsApp, mail…). Quien la ofrece ya chequeó el permiso del export y que el servidor deja ver esa cuenta.
 */
export function HojaEstadoDeCuenta({ socio, onClose }: Props) {
  const c = useColors()
  const enLinea = useEnLinea()
  const [formato, setFormato] = useState<FormatoEstadoDeCuenta>('Pdf')
  const [periodo, setPeriodo] = useState<PeriodoDeCuenta | null>(null)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cerrar = () => {
    setError(null)
    onClose()
  }

  const compartir = async () => {
    if (!socio || generando || !enLinea) return
    setGenerando(true)
    setError(null)
    const ahora = Date.now()
    const rango = periodo ? rangoDelPeriodo(periodo, ahora) : undefined
    const r = await sharePdf(urlEstadoDeCuenta(socio.id, formato, rango), nombreDelArchivo(socio.razonSocial, formato, ahora))
    setGenerando(false)
    if (r.ok) cerrar()
    else setError(r.message)
  }

  const titulo = [typeScale.secundario, { color: c.text, ...pesoSemibold }]
  const ayuda = [typeScale.secundario, { color: c.textSecondary }]

  return (
    <BottomSheet visible={socio !== null} onClose={cerrar} accessibilityLabel="Estado de cuenta">
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={[typeScale.titulo, { color: c.text }]}>Estado de cuenta</Text>
        {socio ? <Text style={[typeScale.cuerpo, { color: c.textSecondary }]}>{socio.razonSocial}</Text> : null}
      </View>
      <Text style={ayuda}>Lo que debe y lo que pagó, de sus dos cuentas, para mandárselo al cliente.</Text>

      <View style={{ gap: space[2] }}>
        <Text style={titulo}>Formato</Text>
        <Segmented options={FORMATOS} value={formato} onChange={setFormato} accessibilityLabel="Formato del archivo" />
      </View>

      <View style={{ gap: space[2] }}>
        <Text style={titulo}>Período</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Período" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <FiltroChip rol="radio" label="Todo" activo={periodo === null} onPress={() => setPeriodo(null)} />
          {PERIODOS_DE_CUENTA.map(p => (
            <FiltroChip key={p.valor} rol="radio" label={p.label} activo={periodo === p.valor} onPress={() => setPeriodo(p.valor)} />
          ))}
        </View>
      </View>

      {error ? <Notice tone="peligro">{error}</Notice> : null}
      {!enLinea ? <MotivoDeshabilitado>{SIN_CONEXION}</MotivoDeshabilitado> : null}
      <Button label="Compartir" icon={Share2} loading={generando} disabled={!enLinea} onPress={() => void compartir()} />
    </BottomSheet>
  )
}

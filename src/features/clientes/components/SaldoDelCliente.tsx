import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { StatusChip, formatImporte } from '@/core/ui/fw'

/** Desde qué parte del tope usado la barra de crédito avisa en amarillo (v2: aviso arriba del 80 % de uso). */
export const USO_DE_CREDITO_EN_AVISO = 0.8

interface HeroSaldoProps {
  saldo: number
  /** Lo vencido que dice el servidor; null o 0, sin chip. */
  vencido: number | null
  /** Días hábiles de la deuda más vieja (SocioDetailDto): solo se dice junto a lo vencido. */
  diasDeudaMasVieja?: number | null
  /** Tope de crédito del cliente; sin tope no hay barra. */
  tope: number | null
  /** Crédito disponible que dice el servidor; negativo = pasado del tope. Null: sin renglón de crédito. */
  disponible: number | null
  /** Lo que lee el lector de pantalla del saldo ("Saldo $ X" en la ficha, "Saldo: $ X" en la cuenta). */
  accessibilityLabel: string
  /** Texto arriba de la cifra. Por defecto "Saldo"; la ficha de proveedor dice "Le debemos", "A favor" o "Al día". */
  etiqueta?: string
}

/**
 * Hero de saldo (propuesta "Clientes como venta", frames 5, 11 y 13): una sola cifra grande sobre fondo oscuro,
 * lo vencido con la deuda más vieja y la barra del crédito usado. Mobile no calcula vencimientos ni topes:
 * muestra lo que manda el servidor; la barra solo reparte el tope entre usado y disponible.
 */
export function HeroSaldo({ saldo, vencido, diasDeudaMasVieja, tope, disponible, accessibilityLabel, etiqueta = 'Saldo' }: HeroSaldoProps) {
  const c = useColors()
  const pasado = disponible !== null && disponible < 0
  const usado = tope !== null && disponible !== null ? Math.min(tope, Math.max(0, tope - disponible)) : 0
  const enAviso = pasado || (tope !== null && tope > 0 && usado / tope > USO_DE_CREDITO_EN_AVISO)
  const dias = vencido !== null && vencido > 0 && diasDeudaMasVieja ? diasDeudaMasVieja : null
  return (
    <View
      testID="hero-saldo"
      style={{ backgroundColor: c.topBar, borderWidth: 1, borderColor: c.topBarBorder, borderRadius: radii.hoja, padding: space[4], gap: 10 }}
    >
      <View accessible accessibilityLabel={accessibilityLabel}>
        <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>{etiqueta}</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[typeScale.titulo, importe, { fontSize: 32, lineHeight: 40, fontWeight: '700', color: c.onTopBarStrong }]}
        >
          {formatImporte(saldo)}
        </Text>
      </View>
      {vencido !== null && vencido > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] }}>
          <StatusChip estado="anulado" label={`Vencido ${formatImporte(vencido)}`} />
          {dias ? (
            <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>{`Deuda más vieja: ${dias} ${dias === 1 ? 'día' : 'días'}`}</Text>
          ) : null}
        </View>
      ) : null}
      {tope !== null && disponible !== null ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Crédito usado"
          accessibilityValue={{ min: 0, max: tope, now: usado }}
          style={{ height: space[2], borderRadius: radii.pastilla, overflow: 'hidden' }}
        >
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.onTopBar, opacity: 0.3 }} />
          <View
            testID="hero-credito-relleno"
            style={{ height: space[2], width: `${tope > 0 ? (usado / tope) * 100 : 0}%`, backgroundColor: enAviso ? c.warning : c.brand }}
          />
        </View>
      ) : null}
      {disponible !== null ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text style={{ ...typeScale.secundario, color: c.onTopBar }}>{pasado ? 'Pasado del tope' : 'Crédito libre'}</Text>
          {pasado ? (
            <StatusChip estado="anulado" label={formatImporte(-disponible)} />
          ) : (
            <Text style={[typeScale.cuerpoDestacado, importe, { color: c.onTopBarStrong }]}>{formatImporte(disponible)}</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}

/** TST y Normal en dos tarjetas sin borde (frames 5 y 13), con la etiqueta que lee el lector de pantalla. */
export function SaldosPorCuenta({ tst, normal }: { tst: number; normal: number }) {
  const c = useColors()
  const tarjeta = (etiqueta: string, valor: number, paraElLector = etiqueta) => (
    <View
      accessible
      accessibilityLabel={`${paraElLector}: ${formatImporte(valor)}`}
      style={{ flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[3], gap: 2 }}
    >
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{etiqueta}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[typeScale.titulo, importe, { fontWeight: '700', color: c.text }]}>{formatImporte(valor)}</Text>
    </View>
  )
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      {tarjeta('Cuenta TST', tst)}
      {tarjeta('Normal (con factura)', normal, 'Cuenta Normal (con factura)')}
    </View>
  )
}

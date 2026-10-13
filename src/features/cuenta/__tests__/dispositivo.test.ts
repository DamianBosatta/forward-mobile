/**
 * Nombre legible del dispositivo de una sesión (BACKLOG-9B, "Mi cuenta: sesiones"): el servidor
 * guarda el User-Agent crudo y la lámina MiCuenta muestra "App Forward en Android", "Chrome en Windows".
 */
import { DISPOSITIVO_DESCONOCIDO, nombreDeDispositivo } from '../lib/dispositivo'

const UA = {
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.65',
  operaWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 OPR/101.0.0.0',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  safariIpad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36',
  edgeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 EdgA/129.0.2792.84',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  chromeLinux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  appAndroid: 'okhttp/4.12.0',
  appIos: 'Forward%20ERP/1 CFNetwork/1494.0.7 Darwin/23.4.0',
  expoGoIos: 'Expo/2.31.2 CFNetwork/1494.0.7 Darwin/23.4.0',
}

describe('nombreDeDispositivo', () => {
  it.each([
    ['Chrome en Windows', UA.chromeWindows, 'Windows · Chrome'],
    ['Edge en Windows (también dice Chrome y Safari)', UA.edgeWindows, 'Windows · Edge'],
    ['Opera en Windows (también dice Chrome y Safari)', UA.operaWindows, 'Windows · Opera'],
    ['Safari en iPhone (dice "like Mac OS X")', UA.safariIphone, 'iPhone · Safari'],
    ['Chrome en iPhone', UA.chromeIphone, 'iPhone · Chrome'],
    ['Safari en iPad', UA.safariIpad, 'iPad · Safari'],
    ['Safari en Mac', UA.safariMac, 'Mac · Safari'],
    ['Chrome en Android (dice "Linux")', UA.chromeAndroid, 'Android · Chrome'],
    ['Edge en Android', UA.edgeAndroid, 'Android · Edge'],
    ['Firefox en Linux', UA.firefoxLinux, 'Linux · Firefox'],
    ['Chrome en Linux', UA.chromeLinux, 'Linux · Chrome'],
  ])('%s', (_caso, ua, esperado) => {
    expect(nombreDeDispositivo(ua)).toBe(esperado)
  })

  it('reconoce la app: OkHttp en Android, CFNetwork en iOS y Expo Go', () => {
    expect(nombreDeDispositivo(UA.appAndroid)).toBe('Android · App Forward')
    expect(nombreDeDispositivo(UA.appIos)).toBe('iOS · App Forward')
    expect(nombreDeDispositivo(UA.expoGoIos)).toBe('iOS · App Forward')
  })

  it('ignora espacios alrededor del User-Agent', () => {
    expect(nombreDeDispositivo(`  ${UA.firefoxLinux}\n`)).toBe('Linux · Firefox')
  })

  it('si solo reconoce el sistema o solo el navegador, muestra lo que sabe', () => {
    expect(nombreDeDispositivo('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows')
    expect(nombreDeDispositivo('Firefox/130.0')).toBe('Firefox')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['vacío', ''],
    ['solo espacios', '   '],
    ['basura', '#@!$%^ ¿¿¿ ???'],
    ['un cliente que no es navegador', 'curl/8.4.0'],
    ['Postman', 'PostmanRuntime/7.39.0'],
  ])('%s → "Dispositivo desconocido"', (_caso, ua) => {
    expect(nombreDeDispositivo(ua)).toBe(DISPOSITIVO_DESCONOCIDO)
    expect(DISPOSITIVO_DESCONOCIDO).toBe('Dispositivo desconocido')
  })
})

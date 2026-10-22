import type { Caso } from './ejecutar'

/** Casos por regla. La clave es el nombre de la regla en `@forward/reglas`. */
export const CASOS: Readonly<Record<string, readonly Caso[]>> = {
  cuitEsValido: [
    { nombre: 'acepta el CUIT sin separadores', entrada: ['20123456786'], esperado: true },
    { nombre: 'acepta guiones', entrada: ['20-12345678-6'], esperado: true },
    { nombre: 'acepta espacio y barra', entrada: ['20 12345678/6'], esperado: true },
    { nombre: 'rechaza el dígito verificador errado', entrada: ['20123456785'], esperado: false },
    { nombre: 'rechaza menos de 11 dígitos', entrada: ['2012345678'], esperado: false },
    { nombre: 'rechaza más de 11 dígitos', entrada: ['201234567860'], esperado: false },
    { nombre: 'rechaza texto anotado', entrada: ['20-12345678-6 (viejo)'], esperado: false },
    { nombre: 'rechaza el prefijo de texto', entrada: ['CUIT 20123456786'], esperado: false },
    { nombre: 'rechaza el vacío', entrada: [''], esperado: false },
  ],
  tieneComoMuchoDosDecimales: [
    { nombre: 'entero', entrada: [10], esperado: true },
    { nombre: 'un decimal', entrada: [10.5], esperado: true },
    { nombre: 'dos decimales', entrada: [10.25], esperado: true },
    { nombre: 'punto flotante que sigue siendo centavos', entrada: [0.1 + 0.2], esperado: true },
    { nombre: 'tres decimales', entrada: [10.005], esperado: false },
    { nombre: 'milésima chica', entrada: [0.001], esperado: false },
  ],
  redondearDosDecimales: [
    { nombre: 'baja lo que está por debajo de la mitad', entrada: [2.504], esperado: 2.5 },
    { nombre: 'sube 4,999 a 5', entrada: [4.999], esperado: 5 },
    { nombre: 'sube 3,749 a 3,75', entrada: [3.749], esperado: 3.75 },
    { nombre: 'baja 2,494 a 2,49', entrada: [2.494], esperado: 2.49 },
    { nombre: 'empate 2,525 va al par (2,52)', entrada: [2.525], esperado: 2.52 },
    { nombre: 'empate 2,535 va al par (2,54)', entrada: [2.535], esperado: 2.54 },
    { nombre: 'cero queda en cero', entrada: [0], esperado: 0 },
  ],
  redondear2: [
    { nombre: '1,005 sube a 1,01 (no 1,00 como Math.round)', entrada: [1.005], esperado: 1.01 },
    { nombre: '2,675 sube a 2,68', entrada: [2.675], esperado: 2.68 },
    {
      nombre: 'el medio también se aleja del cero en negativos',
      entrada: [-1.005],
      esperado: -1.01,
    },
    { nombre: 'el medio NO va al par (2,525 → 2,53)', entrada: [2.525], esperado: 2.53 },
    { nombre: 'dos decimales quedan igual', entrada: [10.25], esperado: 10.25 },
  ],
  formatearMonto: [
    { nombre: 'punto de miles y coma decimal', entrada: [1234567.891], esperado: '1.234.567,89' },
    { nombre: 'siempre dos decimales', entrada: [10], esperado: '10,00' },
    { nombre: 'redondea 1,005 a 1,01', entrada: [1.005], esperado: '1,01' },
    { nombre: 'pesos lleva el símbolo', entrada: [1234.5, 'ARS'], esperado: '$ 1.234,50' },
    { nombre: 'dólares lleva US$', entrada: [1234.5, 'USD'], esperado: 'US$ 1.234,50' },
  ],
  pisoCesionComision: [
    { nombre: 'es la mitad del configurado', entrada: [5], esperado: 2.5 },
    { nombre: 'la mitad cruda 2,525 se redondea a 2,52', entrada: [5.05], esperado: 2.52 },
    { nombre: 'configurado 7,5 da 3,75', entrada: [7.5], esperado: 3.75 },
  ],
  esCantidadEnteraSiEsBulto: [
    { nombre: 'bulto con fracción no vale', entrada: ['Bulto', 1.5], esperado: false },
    { nombre: 'bulto madre con fracción no vale', entrada: ['BultoMadre', 0.5], esperado: false },
    { nombre: 'bulto entero vale', entrada: ['Bulto', 3], esperado: true },
    { nombre: 'otra unidad admite fracción', entrada: ['Kilo', 1.5], esperado: true },
    { nombre: 'sin unidad admite fracción', entrada: [undefined, 1.5], esperado: true },
  ],
  monedasPermitidas: [
    { nombre: 'ARS está permitida', entrada: ['ARS'], esperado: true },
    { nombre: 'USD está permitida', entrada: ['USD'], esperado: true },
    { nombre: 'EUR no', entrada: ['EUR'], esperado: false },
    { nombre: 'en minúscula no', entrada: ['ars'], esperado: false },
  ],
}

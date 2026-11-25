// Respuesta de POST /Ventas/vista-previa con IVA 21 % sobre un neto de 1200: la comparten los tests de "Con factura".
export const PREVIEW_IVA = {
  requiereAutorizacion: false, motivos: [], rechazos: [], productosSinStock: [], lineas: [],
  total: 1452, totalNeto: 1200, iva: 252, ivaPorAlicuota: [{ alicuota: 'Iva21', porcentaje: 21, neto: 1200, iva: 252 }],
}

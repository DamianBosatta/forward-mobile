import React from "react";
import { render, screen, userEvent } from "@testing-library/react-native";
import { useThemeStore } from "@/libs/theme";
import { TarjetaPedidoTablero } from "../TarjetaPedidoTablero";
import type { VentaTablero } from "../tablero";

const base = {
  id: "v1",
  codigoPedido: "A00417",
  direccion: "Juan B. Justo 6376",
  clienteNombre: "Autoservicio Carlos",
  vendedorNombre: "Emanuel Parraquini",
  estado: 4,
  metodoEntrega: 1,
  metodoEntregaNombre: "LogisticaPropia",
  fechaEntrega: "2026-10-09T13:00:00Z",
  version: 1,
  piezasCount: 2,
  itemsCount: 1,
  unidadesCount: 0,
} as unknown as VentaTablero;

const PASOS = [
  {
    estadoAnterior: null,
    estadoNuevo: 2,
    usuarioNombre: "Emanuel Parraquini",
    fecha: "2026-10-09T13:05:00Z",
  },
  {
    estadoAnterior: 2,
    estadoNuevo: 3,
    usuarioNombre: "Operario Uno",
    fecha: "2026-10-09T14:10:00Z",
  },
  {
    estadoAnterior: 3,
    estadoNuevo: 4,
    usuarioNombre: "Operario Dos",
    fecha: "2026-10-09T15:42:00Z",
  },
];

describe.each(["light", "dark"] as const)(
  "Tarjeta con pasos (%s)",
  (esquema) => {
    beforeEach(() => useThemeStore.setState({ mode: esquema }));
    const pintar = (venta: VentaTablero) =>
      render(
        <TarjetaPedidoTablero
          venta={venta}
          hoy="2026-10-09"
          opciones={{ mostrarUltimoCambio: true }}
          onAbrir={jest.fn()}
        />,
      );

    it("muestra cada paso con estado, usuario, día y hora de Argentina, y el vendedor", () => {
      pintar({
        ...base,
        pasos: PASOS,
        ultimoCambioPor: "Otro",
        ultimoCambioEn: "2026-10-09T15:42:00Z",
      });
      expect(screen.getByText("Emanuel Parraquini")).toBeTruthy();
      expect(
        screen.getByText("Confirmada · Emanuel Parraquini · 09/10 10:05"),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "Confirmada → En Preparación · Operario Uno · 09/10 11:10",
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "En Preparación → Empacada · Operario Dos · 09/10 12:42",
        ),
      ).toBeTruthy();
      // Con pasos, la línea de último cambio se reemplaza.
      expect(screen.queryByText(/^Otro/)).toBeNull();
    });

    it("sin pasos cae en la línea de último cambio", () => {
      pintar({
        ...base,
        ultimoCambioPor: "Operario Uno",
        ultimoCambioEn: "2026-10-09T13:42:00Z",
      });
      expect(screen.getByText("Operario Uno · 09/10 10:42")).toBeTruthy();
    });

    it('con más de 3 pasos muestra los últimos 3 y "Ver todos" despliega el resto', async () => {
      const mas = [
        {
          estadoAnterior: null,
          estadoNuevo: 2,
          usuarioNombre: "Vieja",
          fecha: "2026-10-08T13:00:00Z",
        },
        ...PASOS,
      ];
      pintar({ ...base, pasos: mas });
      expect(screen.queryByText(/Vieja/)).toBeNull();
      await userEvent.press(
        screen.getByRole("button", { name: "Ver todos los pasos" }),
      );
      expect(screen.getByText("Confirmada · Vieja · 08/10 10:00")).toBeTruthy();
    });
  },
);

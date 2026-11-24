// Visual review MD-27: the role in the menu header admits two lines instead of being cut.
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { DrawerHeader } from "../DrawerHeader";

describe.each([true, false])("DrawerHeader (oscuro=%s)", (oscuro) => {
  it("lets the role use two lines and keeps the name on one", () => {
    render(
      <DrawerHeader
        iniciales="AP"
        nombre="Ana Paz"
        rol="Administrador de sistemas · Gerencia"
        oscuro={oscuro}
      />,
    );
    expect(
      screen.getByText("Administrador de sistemas · Gerencia").props
        .numberOfLines,
    ).toBe(2);
    expect(screen.getByText("Ana Paz").props.numberOfLines).toBe(1);
  });
});

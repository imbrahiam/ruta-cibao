import { describe, expect, test } from "bun:test";
import {
  appPath,
  routeAccess,
  safeCallbackPath,
} from "@/modules/access/route-policy";

describe("route access", () => {
  test("protects verification with or without a locale prefix", () => {
    expect(routeAccess("/verificar")).toBe("member");
    expect(routeAccess("/es/verificar")).toBe("member");
  });

  test("leaves public and unknown routes to the router", () => {
    expect(routeAccess("/mapa")).toBe("public");
    expect(routeAccess("/una-ruta-que-no-existe")).toBe("public");
  });

  test("normalizes only known locale segments", () => {
    expect(appPath("/es/verificar")).toBe("/verificar");
    expect(appPath("/en/verificar")).toBe("/en/verificar");
  });
});

describe("auth callback", () => {
  test("keeps a local destination", () => {
    expect(safeCallbackPath("/verificar?paso=1")).toBe("/verificar?paso=1");
  });

  test("rejects absolute and protocol-relative destinations", () => {
    expect(safeCallbackPath("https://example.com")).toBe("/bienvenida");
    expect(safeCallbackPath("//example.com")).toBe("/bienvenida");
    expect(safeCallbackPath("/\\example.com")).toBe("/bienvenida");
  });

  test("rejects unknown routes and a sign-in loop", () => {
    expect(safeCallbackPath("/ruta-inexistente")).toBe("/bienvenida");
    expect(safeCallbackPath("/entrar")).toBe("/bienvenida");
  });
});

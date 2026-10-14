import { expect, test } from "@playwright/test";

test("tablet header fits after account controls finish loading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  const header = page.getByRole("banner");
  const signIn = header.getByRole("button", { name: "Entrar", exact: true });
  await expect(signIn).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Mi cuenta", exact: true }),
  ).toBeVisible();
  await expect(signIn).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("map layers scroll to the final option without moving the page", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 390 : 1280,
    height: 600,
  });
  await page.goto("/mapa");
  await page
    .getByRole("button", { name: "Cambiar la vista", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Cómo ver el mapa",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const title = dialog.getByRole("heading", {
    name: "Cómo ver el mapa",
    exact: true,
  });
  await expect(title).toBeInViewport();
  const before = await page.evaluate(() => window.scrollY);
  const scrollport = dialog.locator('[data-slot="scroll-area-viewport"]');
  await scrollport.hover();
  if (testInfo.project.name === "mobile") {
    const bounds = await scrollport.boundingBox();
    if (!bounds) throw new Error("The map options need a visible scroll area");
    const cdp = await page.context().newCDPSession(page);
    const x = bounds.x + bounds.width / 2;
    const startY = bounds.y + bounds.height * 0.8;
    for (let swipe = 0; swipe < 4; swipe++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: startY }],
      });
      for (let step = 1; step <= 6; step++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: startY - bounds.height * 0.1 * step }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await cdp.detach();
  } else {
    await page.mouse.wheel(0, 1800);
  }
  const finalOption = dialog.getByRole("button", {
    name: /^Negocios de Google/,
  });
  await expect(finalOption).toBeInViewport({ ratio: 1 });
  await expect(title).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  const previous = await finalOption.getAttribute("aria-pressed");
  await finalOption.click();
  await expect(finalOption).toHaveAttribute(
    "aria-pressed",
    previous === "true" ? "false" : "true",
  );
  await page.screenshot({
    path: `/tmp/ruta-layers-${testInfo.project.name}.png`,
    animations: "disabled",
    scale: "css",
  });
  await dialog
    .getByRole("button", { name: "Cerrar opciones del mapa" })
    .click();
  await expect(dialog).toBeHidden();
});

test("landing steps and footer fit and expose useful destinations", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¿Qué necesitas hoy?" }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/ruta-landing-${testInfo.project.name}.png`,
    animations: "disabled",
    scale: "css",
  });
  const features = page.getByRole("region", { name: "Lo que puedes hacer" });
  await features.evaluate((element) =>
    element.scrollIntoView({ block: "start" }),
  );
  await expect(features.getByRole("listitem")).toHaveCount(6);
  await expect(
    features.getByRole("link", { name: /Encuentra un lugar/ }),
  ).toHaveAttribute("href", "/explorar");
  await expect(
    features.getByRole("link", { name: /Escríbele al ayuntamiento/ }),
  ).toHaveAttribute("href", "/consultas");
  await page.screenshot({
    path: `/tmp/ruta-how-${testInfo.project.name}.png`,
    animations: "disabled",
    scale: "css",
  });
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  await expect(
    footer.getByRole("link", { name: "Privacidad" }),
  ).toHaveAttribute("href", "/privacidad");
  await expect(footer.getByRole("link", { name: "Rutas" })).toHaveAttribute(
    "href",
    "/rutas",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/ruta-footer-${testInfo.project.name}.png`,
    animations: "disabled",
    scale: "css",
  });
  expect(errors).toEqual([]);
});

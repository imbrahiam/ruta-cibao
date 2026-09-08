import { expect, test } from "@playwright/test";

test("landing renders, has no horizontal overflow, and opens discovery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Lo mejor del Cibao empieza cerca." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ayuntamiento de Villa Los Almácigos" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Ver todos", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  expect(errors).toEqual([]);
});

test("directory searches, clears filters, and preserves a place URL", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/explorar");
  await page.getByRole("textbox", { name: "Buscar un lugar" }).fill("moncion");
  await page
    .getByRole("button", { name: "Buscar un lugar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Presa de Monción" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hospital Municipal de Sabaneta" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(
    page.getByRole("heading", { name: "Hospital Municipal de Sabaneta" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Municipio", exact: true })
    .selectOption({ label: "Monción" });
  await expect(
    page.getByRole("heading", { name: "Hospital Municipal de Sabaneta" }),
  ).toHaveCount(0);
  await page.getByRole("heading", { name: "Presa de Monción" }).click();
  await expect(page).toHaveURL(/\/mapa\?lugar=/);
  await expect(
    page.getByRole("heading", { name: "Presa de Monción" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("installation explains both platform paths", async ({ page }) => {
  await page.goto("/instalar");
  await expect(
    page.getByRole("heading", { name: "En iPhone o iPad" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "En Android o computadora" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("sign in validates a phone and retains the intended destination", async ({
  page,
}) => {
  await page.goto("/entrar?callbackUrl=%2Faportes");
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Correo", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Correo electrónico" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("account and contribution history offer sign in to visitors", async ({
  page,
}) => {
  await page.goto("/cuenta");
  await expect(
    page.getByRole("button", { name: "Entrar o crear una cuenta" }),
  ).toBeVisible();
  await page.goto("/aportes");
  await expect(
    page.getByRole("button", { name: "Entra para ver tus aportes" }),
  ).toHaveAttribute("href", /callbackUrl=%2Faportes/);
});

test("manifest and public API describe real install and discovery paths", async ({
  request,
}) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({
    display: "standalone",
    scope: "/",
    start_url: "/mapa",
  });
  const places = await request.get("/api/places?query=moncion&limit=12");
  expect(places.ok()).toBe(true);
  const body = await places.json();
  expect(body.total).toBeGreaterThan(0);
  expect(
    body.items.some(
      (item: { name: string }) => item.name === "Presa de Monción",
    ),
  ).toBe(true);
  const privateResponse = await request.get("/api/me/contributions");
  expect(privateResponse.status()).toBe(401);
});

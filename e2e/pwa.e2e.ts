import { expect, test } from "@playwright/test";

test.skip(
  process.env.E2E_PWA !== "1",
  "Requires a production build and E2E_PWA=1.",
);

test("production worker controls the root and serves a neutral offline page", async ({
  page,
  context,
}) => {
  await page.goto("/instalar");
  const registration = await page.evaluate(async () => {
    const worker = await navigator.serviceWorker.ready;
    return {
      scope: new URL(worker.scope).pathname,
      active: worker.active?.state,
    };
  });
  expect(registration.scope).toBe("/");
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await navigator.serviceWorker.ready).active?.state,
      ),
    )
    .toBe("activated");
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/not-previously-visited", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Esta parte necesita conexión" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Volver a intentar" }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Abrir el mapa" }).click();
  await expect(page).toHaveURL(/\/mapa$/);
});

test("private API responses and third-party tiles are absent from caches", async ({
  page,
}) => {
  await page.goto("/cuenta");
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined),
  );
  await page.reload();
  await page.evaluate(async () => {
    await fetch("/api/me");
  });
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(
      names.map(async (name) =>
        (await (await caches.open(name)).keys()).map((request) => request.url),
      ),
    );
    return entries.flat().map((url) => ({
      origin: new URL(url).origin,
      pathname: new URL(url).pathname,
    }));
  });
  expect(cached.some((entry) => entry.pathname.startsWith("/api/"))).toBe(
    false,
  );
  expect(cached.some((entry) => entry.pathname === "/cuenta")).toBe(false);
  expect(
    cached.every((entry) => entry.origin === new URL(page.url()).origin),
  ).toBe(true);
});

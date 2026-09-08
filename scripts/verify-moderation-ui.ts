import { createHmac } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { getCookies } from "better-auth/cookies";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import { categories, memberProfiles, session, user } from "../src/db/schema";
import { getAuth } from "../src/lib/auth";
import { env } from "../src/lib/env";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
if (
  !env.JCE_USE_MOCK ||
  !["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname) ||
  !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
)
  throw new Error(
    "Moderation UI verification requires local services and JCE_USE_MOCK=1",
  );

const userId = crypto.randomUUID();
const token = crypto.randomUUID();
const prefix = `QA ${userId.slice(0, 8)}`;
const fixtures = Array.from({ length: 18 }, (_, index) => ({
  id: `${userId}-${index}`,
  name: `${prefix} category ${String(index + 1).padStart(2, "0")}`,
  kind: "consultation" as const,
  isActive: false,
  sortOrder: 800 + index,
}));
const browser = await chromium.launch();

try {
  await db.insert(user).values({
    id: userId,
    name: "UI Verification",
    email: `${userId}@example.invalid`,
  });
  await db.insert(memberProfiles).values({
    userId,
    displayName: "UI Verification",
    tier: "citizen",
    cedulaStatus: "verified",
    verifiedFullName: "UI Verification",
    municipalityId: "moncion",
    staffRole: "admin",
  });
  await db.insert(session).values({
    id: crypto.randomUUID(),
    token,
    userId,
    expiresAt: new Date(Date.now() + 600_000),
    updatedAt: new Date(),
  });
  await db.insert(categories).values(fixtures);
  const signature = createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(token)
    .digest("base64");
  const cookie = getCookies(getAuth().options).sessionToken;

  for (const mobile of [false, true]) {
    const mode = mobile ? "mobile" : "desktop";
    const context = await browser.newContext({
      viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    await context.addCookies([
      {
        name: cookie.name,
        value: encodeURIComponent(`${token}.${signature}`),
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/moderacion`);
    const tools = page.getByRole("navigation", {
      name: "Herramientas de moderación",
    });
    const manage = tools.getByRole("link", {
      name: "Gestionar categorías y temas",
    });
    await expect(manage).toBeInViewport({ ratio: 1 });
    await expect(
      tools.getByRole("link", { name: /Revisar rutas/ }),
    ).toHaveAttribute("href", "/rutas?ver=pendientes");
    const navBounds = await tools.boundingBox();
    const queueBounds = await page.getByRole("tablist").boundingBox();
    if (!navBounds || !queueBounds)
      throw new Error("The moderation navigation and queue must render");
    expect(navBounds.y + navBounds.height).toBeLessThanOrEqual(queueBounds.y);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(manage).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: `/tmp/ruta-moderation-${mode}.png`,
      scale: "css",
    });
    await manage.click();
    await expect(
      page.getByRole("heading", { name: "Categorías y temas", exact: true }),
    ).toBeVisible();
    const list = page.getByRole("region", { name: "Categorías existentes" });
    await list
      .getByRole("searchbox", { name: "Buscar por nombre" })
      .fill(prefix);
    await expect(list.getByRole("listitem")).toHaveCount(fixtures.length);
    await list.scrollIntoViewIfNeeded();
    const viewport = list.locator('[data-slot="scroll-area-viewport"]');
    const pageScroll = await page.evaluate(() => window.scrollY);
    await viewport.hover();
    if (mobile) {
      const bounds = await viewport.boundingBox();
      if (!bounds)
        throw new Error("The category list needs a visible viewport");
      const cdp = await context.newCDPSession(page);
      const x = bounds.x + bounds.width / 2;
      const startY = bounds.y + bounds.height * 0.8;
      for (let swipe = 0; swipe < 6; swipe++) {
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
      await page.mouse.wheel(0, 2400);
    }
    const lastName = `${prefix} category 18`;
    const edit = list.getByRole("button", {
      name: `Editar ${lastName}`,
      exact: true,
    });
    await expect(edit).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    await expect(list.getByRole("searchbox")).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: `/tmp/ruta-categories-${mode}.png`,
      scale: "css",
    });
    await edit.click();
    const name = page.getByRole("textbox", { name: "Nombre", exact: true });
    await expect(name).toHaveValue(lastName);
    await expect(name).toBeFocused();
    await expect(name).toBeInViewport({ ratio: 1 });
    await page
      .getByRole("button", { name: "Nueva categoría", exact: true })
      .click();
    await expect(name).toHaveValue("");
    await expect(name).toBeFocused();
    await page.getByRole("searchbox").fill(`${prefix} absent`);
    await expect(
      list.getByText("No hay categorías con ese nombre."),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Funcionalidad" })
      .selectOption("traffic");
    await expect(page.getByRole("searchbox")).toHaveValue("");
    await expect(
      page.getByRole("combobox", { name: "Impacto vial" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Volver a moderación" }).click();
    await expect(page).toHaveURL(`${baseURL}/moderacion`);
    expect(errors).toEqual([]);
    await context.close();
    console.log(
      `PASS ${mode}: reachable moderation actions, independent category scroll, search, and editor focus`,
    );
  }

  await db
    .update(memberProfiles)
    .set({ staffRole: "moderator" })
    .where(eq(memberProfiles.userId, userId));
  const page = await browser.newPage();
  await page.context().addCookies([
    {
      name: cookie.name,
      value: encodeURIComponent(`${token}.${signature}`),
      url: baseURL,
    },
  ]);
  await page.goto(`${baseURL}/moderacion`);
  await expect(page.getByRole("link", { name: /Revisar rutas/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gestionar categorías y temas" }),
  ).toHaveCount(0);
  await page.goto(`${baseURL}/moderacion/temas`);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Esta sección es para moderadores" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nueva categoría" }),
  ).toHaveCount(0);
  console.log("PASS: category management remains restricted to administrators");
} finally {
  await browser.close();
  await db.delete(categories).where(
    inArray(
      categories.id,
      fixtures.map((row) => row.id),
    ),
  );
  await db.delete(user).where(eq(user.id, userId));
  await pool.end();
  console.log(
    "Removed the temporary UI verification account, session, and categories",
  );
}

import { chromium, expect } from "@playwright/test";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  auditEvents,
  idempotencyKeys,
  memberProfiles,
  places,
  user,
  verification,
} from "../src/db/schema";
import { env } from "../src/lib/env";
import { isSmsConfigured } from "../src/lib/sms";

// This fixture creates and removes only its own account and place on a local
// database. Never use it against a deployment or an SMS-enabled environment.
if (
  !new Set(["localhost", "127.0.0.1"]).has(
    new URL(env.DATABASE_URL).hostname,
  ) ||
  isSmsConfigured()
) {
  throw new Error(
    "Core verification requires a local database and disabled SMS delivery.",
  );
}

const baseURL = "http://localhost:3000";
const phone = `80955501${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
const e164 = `+1${phone}`;
const existing = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.phoneNumber, e164));
if (existing.length)
  throw new Error("The fixture number is already in use. Run again.");
const title = `Verification ${crypto.randomUUID().slice(0, 8)}`;
let fixtureUserId: string | undefined;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.setDefaultTimeout(12_000);
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${baseURL}/entrar?callbackUrl=%2Faportes`);
  await page
    .getByRole("textbox", { name: "Tu celular", exact: true })
    .fill(phone);
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByLabel("Código de 6 dígitos")).toBeVisible();
  const [otp] = await db
    .select({ value: verification.value })
    .from(verification)
    .where(eq(verification.identifier, e164))
    .orderBy(desc(verification.createdAt))
    .limit(1);
  if (!otp) throw new Error("The local sign-in code was not persisted.");
  await page
    .getByLabel("Código de 6 dígitos")
    .fill(otp.value.split(":")[0] ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/bienvenida/);
  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.phoneNumber, e164));
  if (!account) throw new Error("Sign-in did not create the account.");
  fixtureUserId = account.id;
  await page.getByRole("button", { name: /Soy visitante/ }).click();
  await expect(page).toHaveURL(/\/aportes$/);
  console.log("PASS: phone sign-in, onboarding, and callback destination");

  await page.goto(`${baseURL}/mapa?lugar=presa-de-moncion`);
  await page.getByRole("button", { name: "Más opciones" }).click();
  await page.getByRole("menuitem", { name: "Guardar este lugar" }).click();
  await page.getByRole("button", { name: "Más opciones" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Quitar de guardados" }),
  ).toBeVisible();
  console.log("PASS: save a published place");

  await page.goto(`${baseURL}/mapa?agregar=true`);
  await page.getByRole("button", { name: "Fijar aquí" }).click();
  await page.getByLabel("Nombre del lugar").fill(title);
  await page.getByRole("combobox").selectOption("parque");
  await page
    .getByLabel("Descripción", { exact: true })
    .fill(
      "Automated verification of a local community place. This fixture is removed after the check.",
    );
  await page.getByRole("button", { name: "Enviar para revisión" }).click();
  await expect(
    page.getByText("Lugar enviado. Te avisaremos cuando lo revisen."),
  ).toBeVisible();
  const [submitted] = await db
    .select({ id: places.id, status: places.status })
    .from(places)
    .where(
      and(eq(places.createdByUserId, fixtureUserId), eq(places.name, title)),
    );
  expect(submitted?.status).toBe("pending");
  await page.goto(`${baseURL}/aportes`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  console.log(
    "PASS: map selection, place submission, and contribution history",
  );

  await db
    .update(memberProfiles)
    .set({
      tier: "citizen",
      cedulaStatus: "verified",
      staffRole: "admin",
      municipalityId: "moncion",
      verifiedFullName: "Verification Fixture",
    })
    .where(eq(memberProfiles.userId, fixtureUserId));
  await page.goto(`${baseURL}/moderacion`);
  const article = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: title }) });
  await article.getByRole("button", { name: "Rechazar", exact: true }).click();
  await article
    .getByRole("textbox")
    .fill("Verification fixture; removed after checking moderation feedback.");
  await article.getByRole("button", { name: "Confirmar rechazo" }).click();
  await expect(article).toHaveCount(0);
  await page.goto(`${baseURL}/aportes`);
  await expect(
    page.getByText(
      "Verification fixture; removed after checking moderation feedback.",
    ),
  ).toBeVisible();
  const audits = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(eq(auditEvents.actorUserId, fixtureUserId));
  expect(audits[0]?.count).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
  console.log("PASS: moderation decision, author feedback, and audit trail");
} catch (error) {
  await page.screenshot({ path: "/tmp/ruta-core-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
  if (fixtureUserId) {
    await db.delete(places).where(eq(places.createdByUserId, fixtureUserId));
    await db
      .delete(idempotencyKeys)
      .where(eq(idempotencyKeys.userId, fixtureUserId));
    await db
      .delete(auditEvents)
      .where(eq(auditEvents.actorUserId, fixtureUserId));
    await db.delete(user).where(eq(user.id, fixtureUserId));
  }
  await db.delete(verification).where(eq(verification.identifier, e164));
  await pool.end();
  console.log("Removed local verification fixtures.");
}

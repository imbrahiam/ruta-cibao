/**
 * Fills a development database with a province that looks lived-in.
 *
 * `db:seed` puts in the reference data the app cannot start without —
 * municipalities, the taxonomy, a handful of real landmarks. This puts in
 * everything that only exists because people used it: reports on the roads,
 * cases open with the ayuntamiento, businesses claimed, neighbours confirming
 * each other. Without it every screen is an empty state, which is a poor way to
 * judge a design and an impossible way to demonstrate one.
 *
 *   bun run db:seed:demo
 *
 * Development only, and it says so: it refuses to run against a production
 * `NODE_ENV`, because the accounts it invents are sign-in-able people with no
 * real person behind them.
 *
 * Idempotent by construction. Every row it writes carries a deterministic id
 * derived from its own name, so running it twice updates the same rows rather
 * than growing a second copy of the province.
 */

import { createHash, randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  businessClaims,
  consultationResponses,
  consultations,
  consultationVotes,
  memberProfiles,
  notifications,
  placeConfirmations,
  places,
  TRAFFIC_REPORT_TTL_MINUTES,
  trafficConfirmations,
  trafficReports,
  user,
} from "@/db/schema";
import { env } from "@/lib/env";
import { streetAt } from "@/lib/map/roads";

/** Stable ids from names, so a second run updates rather than duplicates. */
function idFor(kind: string, name: string): string {
  return `demo-${kind}-${createHash("sha1").update(name).digest("hex").slice(0, 12)}`;
}

/**
 * The same idea where the column is a `uuid`.
 *
 * A name-based UUID (version 5, as the RFC defines it): the SHA-1 of the name
 * with the version and variant bits set. Deterministic like `idFor`, and a
 * shape PostgreSQL will accept — a `demo-case-…` string is neither.
 */
function uuidFor(kind: string, name: string): string {
  const hash = createHash("sha1").update(`ruta-cibao:${kind}:${name}`).digest();
  // Version 5 in the high nibble of byte 6, RFC variant in the top bits of 8.
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** A readable slug, so a demo URL looks like the real thing. */
function slugFor(title: string): string {
  return `${title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)}-demo`;
}

const HOUR = 60 * 60 * 1_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

/**
 * The neighbours.
 *
 * A spread of tiers on purpose: the interface weighs a verified resident's word
 * differently from a visitor's in half a dozen places, and a demo where
 * everybody is verified shows none of it. `staffRole` gives the moderation desk
 * and the weekly report somebody to belong to.
 */
const PEOPLE = [
  {
    name: "Altagracia Peña",
    municipality: "sabaneta",
    tier: "citizen",
    staff: "admin",
  },
  {
    name: "Ramón Ureña",
    municipality: "sabaneta",
    tier: "citizen",
    staff: "moderator",
  },
  {
    name: "Yudelka Tavárez",
    municipality: "moncion",
    tier: "citizen",
    staff: "moderator",
  },
  {
    name: "Franklin Rodríguez",
    municipality: "sabaneta",
    tier: "citizen",
    staff: "none",
  },
  {
    name: "Miguelina Cruz",
    municipality: "moncion",
    tier: "citizen",
    staff: "none",
  },
  {
    name: "José Antonio Fermín",
    municipality: "villa-los-almacigos",
    tier: "citizen",
    staff: "none",
  },
  {
    name: "Rosa Jiménez",
    municipality: "sabaneta",
    tier: "citizen",
    staff: "none",
  },
  {
    name: "Wilson Bencosme",
    municipality: "moncion",
    tier: "visitor",
    staff: "none",
  },
  {
    name: "Katherine Almonte",
    municipality: "sabaneta",
    tier: "visitor",
    staff: "none",
  },
] as const;

/**
 * What people are reporting on the roads.
 *
 * Real coordinates in the three municipalities, and a mix of shapes: the map
 * draws a stretch differently from a point, and the severity scale only shows
 * its range when something is red, something amber and something already
 * cleared.
 */
const TRAFFIC = [
  {
    label: "Vía bloqueada en Sabaneta",
    category: "via-bloqueada",
    at: { lng: -71.3506, lat: 19.4833 },
    street: true,
    description: "Camión atravesado desde esta mañana. No se puede pasar.",
    hoursAgo: 2,
    confirmations: 3,
  },
  {
    label: "Inundación cerca del río",
    category: "inundacion",
    at: { lng: -71.33688, lat: 19.47772 },
    street: true,
    description: "El agua sube hasta la mitad de la goma. Mejor dar la vuelta.",
    hoursAgo: 1,
    confirmations: 2,
  },
  {
    label: "Hoyo en Monción",
    category: "hoyo",
    at: { lng: -71.1447, lat: 19.4171 },
    street: false,
    description: "Hoyo grande justo saliendo del parque.",
    hoursAgo: 5,
    confirmations: 1,
  },
  {
    label: "Hoyo en Villa Los Almácigos",
    category: "hoyo",
    at: { lng: -71.4172, lat: 19.4162 },
    street: false,
    description: null,
    hoursAgo: 3,
    confirmations: 0,
  },
  {
    // Already over: the map keeps it green for a few hours, which is the one
    // colour a speed-based traffic layer cannot have.
    label: "Inundación resuelta",
    category: "inundacion",
    at: { lng: -71.3489, lat: 19.4851 },
    street: true,
    description: "Bajó el agua, ya se puede pasar.",
    hoursAgo: 4,
    confirmations: 0,
    cleared: true,
  },
] as const;

const CASES = [
  {
    title: "El agua no llega al barrio Los Cerros",
    category: "agua",
    municipality: "sabaneta",
    body: "Llevamos tres semanas sin agua en la parte alta del barrio. Las familias están comprando botellones y no todo el mundo puede. ¿Hay alguna avería o es el horario de bombeo?",
    votes: 6,
    replies: [
      {
        body: "Recibimos el caso y lo pasamos a la oficina de agua potable. Vamos a revisar la bomba esta semana.",
        status: "in_review",
        hoursAgo: 40,
      },
      {
        body: "La bomba tenía una válvula dañada. Ya se cambió y el servicio vuelve por horario normal desde mañana.",
        status: "resolved",
        hoursAgo: 6,
      },
    ],
    hoursAgo: 72,
  },
  {
    title: "Falta alumbrado en la calle Duarte",
    category: "alumbrado",
    municipality: "moncion",
    body: "Desde el mes pasado están apagadas casi todas las luces entre el parque y la escuela. De noche la gente camina por el medio de la calle porque no se ve la acera.",
    votes: 11,
    replies: [
      {
        body: "Anotado. Estamos levantando las luminarias dañadas en todo el sector para pedirlas juntas.",
        status: "in_review",
        hoursAgo: 20,
      },
    ],
    hoursAgo: 50,
  },
  {
    title: "La basura no la recogen los martes",
    category: "basura",
    municipality: "sabaneta",
    body: "El camión pasaba martes y viernes, pero hace un mes solo viene los viernes. Para el martes ya hay fundas en la acera y los perros las rompen.",
    votes: 4,
    replies: [],
    hoursAgo: 26,
  },
  {
    title: "Hoyos en el camino a la presa",
    category: "vias",
    municipality: "villa-los-almacigos",
    body: "El tramo de tierra que sube a la presa está muy malo después de las lluvias. Los carros pequeños no pasan y las guaguas están dando la vuelta larga.",
    votes: 8,
    replies: [],
    hoursAgo: 10,
  },
] as const;

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "seed-demo invents sign-in-able accounts and never runs in production.",
    );
  }

  // ── People ─────────────────────────────────────────────────────────────
  const userIds = new Map<string, string>();

  for (const person of PEOPLE) {
    const id = idFor("user", person.name);
    userIds.set(person.name, id);

    const email = `${id}@demo.rutacibao.local`;

    await db
      .insert(user)
      .values({ id, name: person.name, email, emailVerified: true })
      .onConflictDoUpdate({
        target: user.id,
        set: { name: person.name, email },
      });

    await db
      .insert(memberProfiles)
      .values({
        userId: id,
        displayName: person.name,
        tier: person.tier,
        staffRole: person.staff,
        municipalityId: person.municipality,
        cedulaStatus: person.tier === "citizen" ? "verified" : "none",
        verifiedFullName:
          person.tier === "citizen" ? person.name.toUpperCase() : null,
        verifiedAt: person.tier === "citizen" ? ago(200) : null,
        residencyDeclaredAt: ago(200),
      })
      .onConflictDoUpdate({
        target: memberProfiles.userId,
        set: {
          displayName: person.name,
          tier: person.tier,
          staffRole: person.staff,
          municipalityId: person.municipality,
        },
      });
  }

  const ids = [...userIds.values()];
  console.log(`people: ${ids.length}`);

  // ── Traffic ────────────────────────────────────────────────────────────
  // Cleared out first: these carry timestamps relative to *now*, so a re-run
  // has to replace them rather than leave yesterday's on the map.
  await db
    .delete(trafficReports)
    .where(sql`${trafficReports.reportedByUserId} in ${ids}`);

  let trafficCount = 0;

  for (const [index, item] of TRAFFIC.entries()) {
    const reporter = ids[index % ids.length];
    if (!reporter) continue;

    // The same lookup the app itself uses, so a demo stretch follows the road
    // exactly as a real one would.
    const street = item.street ? (await streetAt(item.at)).street : null;
    const created = ago(item.hoursAgo);

    const [row] = await db
      .insert(trafficReports)
      .values({
        categoryId: item.category,
        municipalityId:
          PEOPLE[index % PEOPLE.length]?.municipality ?? "sabaneta",
        location: { x: item.at.lng, y: item.at.lat },
        path: street?.path.map((p) => ({ x: p.lng, y: p.lat })) ?? null,
        description: item.description,
        reportedByUserId: reporter,
        status: "cleared" in item && item.cleared ? "cleared" : "active",
        resolvedAt: "cleared" in item && item.cleared ? ago(1) : null,
        createdAt: created,
        expiresAt: new Date(
          created.getTime() + TRAFFIC_REPORT_TTL_MINUTES * 60 * 1_000,
        ),
      })
      .returning({ id: trafficReports.id });

    if (!row) continue;
    trafficCount += 1;

    // Neighbours agreeing, which is what puts faces on the report.
    for (let n = 0; n < item.confirmations; n += 1) {
      const voter = ids[(index + n + 1) % ids.length];
      if (!voter || voter === reporter) continue;
      await db
        .insert(trafficConfirmations)
        .values({
          reportId: row.id,
          userId: voter,
          verdict: "still",
          weight:
            PEOPLE[(index + n + 1) % PEOPLE.length]?.tier === "citizen" ? 2 : 1,
        })
        .onConflictDoNothing();
    }
  }

  console.log(`traffic: ${trafficCount} reports`);

  // ── Consultations ──────────────────────────────────────────────────────
  let caseCount = 0;

  for (const [index, item] of CASES.entries()) {
    const id = uuidFor("case", item.title);
    const author = ids[index % ids.length];
    if (!author) continue;

    const created = ago(item.hoursAgo);
    const firstReply = item.replies[0];
    const lastReply = item.replies.at(-1);

    await db
      .insert(consultations)
      .values({
        id,
        slug: slugFor(item.title),
        categoryId: item.category,
        municipalityId: item.municipality,
        title: item.title,
        body: item.body,
        status: lastReply?.status ?? "open",
        openedByUserId: author,
        answeredAt: firstReply ? ago(firstReply.hoursAgo) : null,
        closedAt:
          lastReply && ["resolved", "rejected"].includes(lastReply.status)
            ? ago(lastReply.hoursAgo)
            : null,
        createdAt: created,
      })
      .onConflictDoUpdate({
        target: consultations.id,
        set: {
          title: item.title,
          body: item.body,
          status: lastReply?.status ?? "open",
        },
      });

    caseCount += 1;

    for (let n = 0; n < item.votes; n += 1) {
      const voter = ids[n % ids.length];
      if (!voter) continue;
      await db
        .insert(consultationVotes)
        .values({ consultationId: id, userId: voter })
        .onConflictDoNothing();
    }

    await db
      .delete(consultationResponses)
      .where(eq(consultationResponses.consultationId, id));

    for (const reply of item.replies) {
      // An official from the case's own municipality, since that is the rule
      // the real reply path enforces.
      const officialName = PEOPLE.find(
        (p) => p.staff !== "none" && p.municipality === item.municipality,
      )?.name;

      await db.insert(consultationResponses).values({
        consultationId: id,
        body: reply.body,
        authorUserId: officialName ? (userIds.get(officialName) ?? null) : null,
        statusAfter: reply.status,
        createdAt: ago(reply.hoursAgo),
      });
    }
  }

  console.log(`consultations: ${caseCount}`);

  // ── Businesses ─────────────────────────────────────────────────────────
  const businesses = await db
    .select({ id: places.id, name: places.name })
    .from(places)
    .where(
      inArray(places.slug, [
        "colmado-la-esquina-sabaneta",
        "comedor-dona-mercedes-moncion",
      ]),
    );

  for (const [index, business] of businesses.entries()) {
    const claimant = ids[index + 3];
    if (!claimant) continue;

    await db
      .delete(businessClaims)
      .where(eq(businessClaims.placeId, business.id));

    await db.insert(businessClaims).values({
      placeId: business.id,
      claimantUserId: claimant,
      evidence:
        "Soy el dueño desde hace años, el negocio está a mi nombre y el letrero lleva mi apellido.",
      contactPhone: "+18095550101",
      whatsapp: "+18095550101",
      openingHours: "Lunes a sábado de 7:00 a. m. a 9:00 p. m.",
      // One approved so the map shows a verified business, one pending so the
      // moderation queue has something in it.
      status: index === 0 ? "approved" : "pending",
      decidedAt: index === 0 ? ago(30) : null,
      createdAt: ago(48),
    });
  }

  console.log(`businesses: ${businesses.length} claimed`);

  // ── Trust votes on places ──────────────────────────────────────────────
  const published = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.status, "published"))
    .limit(6);

  for (const [index, place] of published.entries()) {
    for (let n = 0; n < 3; n += 1) {
      const voter = ids[(index + n) % ids.length];
      if (!voter) continue;
      await db
        .insert(placeConfirmations)
        .values({
          placeId: place.id,
          userId: voter,
          verdict: "exists",
          weight: 2,
        })
        .onConflictDoNothing();
    }
  }

  console.log(`places: ${published.length} with trust votes`);

  // ── Notifications ──────────────────────────────────────────────────────
  // So the bell has something in it and the centre is not an empty state.
  const reader = ids[0];
  if (reader) {
    await db.delete(notifications).where(eq(notifications.userId, reader));
    await db.insert(notifications).values([
      {
        id: randomUUID(),
        userId: reader,
        messageKey: "notifications.consultationAnswered",
        params: { title: CASES[0].title },
        href: `/consultas/${slugFor(CASES[0].title)}`,
        createdAt: ago(6),
      },
      {
        id: randomUUID(),
        userId: reader,
        messageKey: "notifications.trafficNearby",
        params: { description: "Vía bloqueada: camión atravesado" },
        href: "/mapa",
        createdAt: ago(2),
      },
      {
        id: randomUUID(),
        userId: reader,
        messageKey: "notifications.placeApproved",
        params: { name: "Presa de Monción" },
        href: "/mapa",
        readAt: ago(20),
        createdAt: ago(24),
      },
    ]);
  }

  console.log("notifications: 3");
  console.log("\ndemo data ready. Sign in as any of:");
  for (const person of PEOPLE.filter((p) => p.staff !== "none")) {
    console.log(
      `  ${idFor("user", person.name)}@demo.rutacibao.local  (${person.staff})`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

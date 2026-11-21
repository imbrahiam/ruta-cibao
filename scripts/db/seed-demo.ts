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
import { appTargetHref } from "@ruta/shared/app-target";
import { formatPhone } from "@ruta/shared/phone";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  auditEvents,
  businessClaims,
  type ConsultationStatus,
  comments,
  consultationPhotos,
  consultationResponses,
  consultations,
  consultationVotes,
  ecoRoutes,
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
import { CONFIRMATION_WEIGHT } from "@/modules/places/trust";

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
 * Every account signs in with a verified phone, which is all participation
 * needs. Some carry the optional in-person resident badge (`resident`), so
 * the interface shows it somewhere; it never changes what anyone may do.
 * `staff` gives the moderation desk and the weekly report somebody to belong
 * to: moderators are confined to their `municipality`, the admin has the
 * province. Names are invented; none of them is a real person, and none has a
 * photo (the app draws initials).
 *
 * Each one has a fictional 809-555-01xx number so the demo can be signed into
 * as any of them: list the numbers in `LOCAL_DEMO_PHONES` and the code is
 * `LOCAL_DEMO_OTP` (local development only, refused in production).
 */
type Person = {
  name: string;
  municipality: MunicipalityId;
  resident: boolean;
  staff: "admin" | "moderator" | "none";
  phone: string;
};

type MunicipalityId = "sabaneta" | "moncion" | "villa-los-almacigos";

const MUNICIPALITY_IDS: readonly MunicipalityId[] = [
  "sabaneta",
  "moncion",
  "villa-los-almacigos",
];

/** The first people the demo ever had, kept exactly as they were. */
const FOUNDERS: readonly Person[] = [
  {
    name: "Altagracia Peña",
    municipality: "sabaneta",
    resident: true,
    staff: "admin",
    phone: "+18095550101",
  },
  {
    name: "Ramón Ureña",
    municipality: "sabaneta",
    resident: true,
    staff: "moderator",
    phone: "+18095550102",
  },
  {
    name: "Yudelka Tavárez",
    municipality: "moncion",
    resident: true,
    staff: "moderator",
    phone: "+18095550103",
  },
  {
    name: "Franklin Rodríguez",
    municipality: "sabaneta",
    resident: true,
    staff: "none",
    phone: "+18095550104",
  },
  {
    name: "Miguelina Cruz",
    municipality: "moncion",
    resident: false,
    staff: "none",
    phone: "+18095550105",
  },
  {
    name: "José Antonio Fermín",
    municipality: "villa-los-almacigos",
    resident: true,
    staff: "none",
    phone: "+18095550106",
  },
  {
    name: "Rosa Jiménez",
    municipality: "sabaneta",
    resident: false,
    staff: "none",
    phone: "+18095550107",
  },
  {
    name: "Wilson Bencosme",
    municipality: "moncion",
    resident: false,
    staff: "none",
    phone: "+18095550108",
  },
  {
    name: "Katherine Almonte",
    municipality: "sabaneta",
    resident: false,
    staff: "none",
    phone: "+18095550109",
  },
];

/**
 * More neighbours, so a list of supporters or commenters reads like a town.
 * Villa Los Almácigos gets its own moderator, which the founders lacked: its
 * cases had no official to answer them.
 */
const NEIGHBOURS: readonly Person[] = [
  {
    name: "Dilcia Mejía",
    municipality: "villa-los-almacigos",
    resident: true,
    staff: "moderator",
    phone: "+18095550110",
  },
  {
    name: "Eladio Cabrera",
    municipality: "sabaneta",
    resident: true,
    staff: "none",
    phone: "+18095550111",
  },
  {
    name: "Marisol Féliz",
    municipality: "sabaneta",
    resident: false,
    staff: "none",
    phone: "+18095550112",
  },
  {
    name: "Julio César Paulino",
    municipality: "sabaneta",
    resident: true,
    staff: "none",
    phone: "+18095550113",
  },
  {
    name: "Nelly Báez",
    municipality: "sabaneta",
    resident: false,
    staff: "none",
    phone: "+18095550114",
  },
  {
    name: "Rafael Estévez",
    municipality: "sabaneta",
    resident: true,
    staff: "none",
    phone: "+18095550115",
  },
  {
    name: "Yokasta Ventura",
    municipality: "sabaneta",
    resident: false,
    staff: "none",
    phone: "+18095550116",
  },
  {
    name: "Domingo Hiciano",
    municipality: "moncion",
    resident: true,
    staff: "none",
    phone: "+18095550117",
  },
  {
    name: "Carmen Luisa Polanco",
    municipality: "moncion",
    resident: true,
    staff: "none",
    phone: "+18095550118",
  },
  {
    name: "Starlin Disla",
    municipality: "moncion",
    resident: false,
    staff: "none",
    phone: "+18095550119",
  },
  {
    name: "Maribel Gil",
    municipality: "moncion",
    resident: false,
    staff: "none",
    phone: "+18095550120",
  },
  {
    name: "Pedro Pablo Cruz",
    municipality: "moncion",
    resident: true,
    staff: "none",
    phone: "+18095550121",
  },
  {
    name: "Ismenia Rosario",
    municipality: "moncion",
    resident: false,
    staff: "none",
    phone: "+18095550122",
  },
  {
    name: "Leonel Santos",
    municipality: "villa-los-almacigos",
    resident: true,
    staff: "none",
    phone: "+18095550123",
  },
  {
    name: "Fior Daliza Medina",
    municipality: "villa-los-almacigos",
    resident: false,
    staff: "none",
    phone: "+18095550124",
  },
  {
    name: "Bienvenido Tineo",
    municipality: "villa-los-almacigos",
    resident: true,
    staff: "none",
    phone: "+18095550125",
  },
  {
    name: "Angélica Valdez",
    municipality: "villa-los-almacigos",
    resident: false,
    staff: "none",
    phone: "+18095550126",
  },
  {
    name: "Hugo Ernesto Peralta",
    municipality: "villa-los-almacigos",
    resident: false,
    staff: "none",
    phone: "+18095550127",
  },
  {
    name: "Gisselle Núñez",
    municipality: "sabaneta",
    resident: false,
    staff: "none",
    phone: "+18095550128",
  },
  {
    name: "Orlando Taveras",
    municipality: "moncion",
    resident: true,
    staff: "none",
    phone: "+18095550129",
  },
  {
    name: "Mireya Collado",
    municipality: "villa-los-almacigos",
    resident: true,
    staff: "none",
    phone: "+18095550130",
  },
];

const PEOPLE: readonly Person[] = [...FOUNDERS, ...NEIGHBOURS];

const peopleOf = (municipality: MunicipalityId) =>
  PEOPLE.filter((p) => p.municipality === municipality);

/** The official who answers for a municipality, as the real reply path requires. */
const officialOf = (municipality: MunicipalityId) =>
  PEOPLE.find((p) => p.staff !== "none" && p.municipality === municipality);

/** Spreads `count` picks from a list without ever returning `except`. */
function pick<T>(list: readonly T[], start: number, count: number, except?: T) {
  const out: T[] = [];
  for (let n = 0; out.length < Math.min(count, list.length - 1); n += 1) {
    const candidate = list[(start + n) % list.length];
    if (candidate !== undefined && candidate !== except) out.push(candidate);
  }
  return out;
}

const CENTERS: Record<MunicipalityId, { lng: number; lat: number }> = {
  sabaneta: { lng: -71.3418, lat: 19.4757 },
  moncion: { lng: -71.1504, lat: 19.4109 },
  "villa-los-almacigos": { lng: -71.4392, lat: 19.4107 },
};

type TrafficSeed = {
  label: string;
  category: "via-bloqueada" | "hoyo" | "inundacion";
  municipality: MunicipalityId;
  at: { lng: number; lat: number };
  street: boolean;
  description: string | null;
  hoursAgo: number;
  confirmations: number;
  /** `active` ones are inside their six-hour window; the rest are history. */
  outcome: "active" | "cleared" | "expired";
};

/**
 * What people are reporting on the roads.
 *
 * Real coordinates in the three municipalities, and a mix of shapes: the map
 * draws a stretch differently from a point, and the severity scale only shows
 * its range when something is red, something amber and something already
 * cleared. The first block is live right now; the history below it is what
 * fills the weekly report's traffic figures for the past six weeks.
 */
const LIVE_TRAFFIC: readonly TrafficSeed[] = [
  {
    label: "Vía bloqueada en Sabaneta",
    category: "via-bloqueada",
    municipality: "sabaneta",
    at: { lng: -71.3392, lat: 19.4769 },
    street: true,
    description: "Camión atravesado desde esta mañana. No se puede pasar.",
    hoursAgo: 2,
    confirmations: 3,
    outcome: "active",
  },
  {
    label: "Inundación cerca del río",
    category: "inundacion",
    municipality: "sabaneta",
    at: { lng: -71.33688, lat: 19.47772 },
    street: true,
    description: "El agua sube hasta la mitad de la goma. Mejor dar la vuelta.",
    hoursAgo: 1,
    confirmations: 2,
    outcome: "active",
  },
  {
    label: "Hoyo en Monción",
    category: "hoyo",
    municipality: "moncion",
    at: { lng: -71.1499, lat: 19.4113 },
    street: false,
    description: "Hoyo grande justo saliendo del parque.",
    hoursAgo: 5,
    confirmations: 1,
    outcome: "active",
  },
  {
    label: "Hoyo en Villa Los Almácigos",
    category: "hoyo",
    municipality: "villa-los-almacigos",
    at: { lng: -71.4392, lat: 19.4107 },
    street: false,
    description: null,
    hoursAgo: 3,
    confirmations: 0,
    outcome: "active",
  },
  // Already over: the map keeps it green for a few hours, which is the one
  // colour a speed-based traffic layer cannot have.
  {
    label: "Inundación resuelta",
    category: "inundacion",
    municipality: "sabaneta",
    at: { lng: -71.3412, lat: 19.4783 },
    street: true,
    description: "Bajó el agua, ya se puede pasar.",
    hoursAgo: 4,
    confirmations: 0,
    outcome: "cleared",
  },
  {
    label: "Árbol caído en la entrada de Monción",
    category: "via-bloqueada",
    municipality: "moncion",
    at: { lng: -71.1531, lat: 19.4085 },
    street: true,
    description:
      "Se cayó un árbol por el viento y ocupa un carril. Pasa un vehículo a la vez.",
    hoursAgo: 3,
    confirmations: 4,
    outcome: "active",
  },
  {
    label: "Agua cruzando el camino de Los Almácigos",
    category: "inundacion",
    municipality: "villa-los-almacigos",
    at: { lng: -71.4351, lat: 19.4122 },
    street: true,
    description:
      "La cañada se desbordó y cruza el camino. Los motores no pasan.",
    hoursAgo: 2,
    confirmations: 2,
    outcome: "active",
  },
  {
    label: "Hoyo frente al hospital de Sabaneta",
    category: "hoyo",
    municipality: "sabaneta",
    at: { lng: -71.3441, lat: 19.4749 },
    street: false,
    description: "Hoyo profundo en el carril derecho. Cuidado de noche.",
    hoursAgo: 4,
    confirmations: 2,
    outcome: "active",
  },
];

const HISTORY_POOL: readonly Pick<TrafficSeed, "category" | "description">[] = [
  {
    category: "hoyo",
    description: "Hoyo grande en medio de la calle, ya dañó una goma.",
  },
  {
    category: "via-bloqueada",
    description: "Guagua dañada ocupando la calle.",
  },
  {
    category: "inundacion",
    description: "Se llenó la calle con el aguacero. Mejor otra ruta.",
  },
  { category: "hoyo", description: "Bache al lado de la parada de guaguas." },
  {
    category: "via-bloqueada",
    description: "Trabajos de la brigada, pasan de uno en uno.",
  },
  { category: "inundacion", description: "El agua tapa la mitad de la calle." },
  {
    category: "via-bloqueada",
    description: "Camión de carga atravesado en la esquina.",
  },
  { category: "hoyo", description: null },
  { category: "inundacion", description: "La cañada subió y cubrió el paso." },
  {
    category: "via-bloqueada",
    description: "Derrumbe pequeño de tierra en la orilla del camino.",
  },
];

/** Thirty past reports spread over the last six weeks, ten per municipality. */
const HISTORIC_TRAFFIC: readonly TrafficSeed[] = Array.from(
  { length: 30 },
  (_, i) => {
    const municipality = MUNICIPALITY_IDS[i % 3] ?? "sabaneta";
    const base =
      HISTORY_POOL[(i * 2 + Math.floor(i / 3)) % HISTORY_POOL.length] ??
      HISTORY_POOL[0];
    const center = CENTERS[municipality];
    return {
      label: `Historial ${i + 1} en ${municipality}`,
      category: base?.category ?? "hoyo",
      municipality,
      at: {
        lng: center.lng + (((i * 7) % 11) - 5) * 0.0016,
        lat: center.lat + (((i * 5) % 9) - 4) * 0.0014,
      },
      street: base?.category !== "hoyo",
      description: base?.description ?? null,
      hoursAgo: 30 + i * 31,
      confirmations: i % 4,
      outcome: i % 4 === 0 ? ("cleared" as const) : ("expired" as const),
    };
  },
);

const TRAFFIC: readonly TrafficSeed[] = [...LIVE_TRAFFIC, ...HISTORIC_TRAFFIC];

type DemoPhoto = { file: string; alt: string };

type DemoCase = {
  title: string;
  category: "agua" | "vias" | "basura" | "alumbrado";
  municipality: MunicipalityId;
  body: string;
  votes: number;
  /** What neighbours say underneath, oldest first. */
  comments?: readonly string[];
  /** What the ayuntamiento wrote back; the last one sets the case's status. */
  replies: readonly {
    body: string;
    status: "in_review" | "answered" | "resolved" | "rejected";
    hoursAgo: number;
  }[];
  photos?: readonly DemoPhoto[];
  hoursAgo: number;
};

const CASES: readonly DemoCase[] = [
  {
    title: "El agua no llega al barrio Los Cerros",
    category: "agua",
    municipality: "sabaneta",
    body: "Llevamos tres semanas sin agua en la parte alta del barrio. Las familias están comprando botellones y no todo el mundo puede. ¿Hay alguna avería o es el horario de bombeo?",
    votes: 6,
    comments: [
      "Nosotros también, en la calle de atrás llevamos casi un mes.",
      "Gracias por avisar, yo ya no sabía a quién preguntar.",
    ],
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
    photos: [{ file: "agua-1.jpg", alt: "Llave de agua seca" }],
    hoursAgo: 72,
  },
  {
    title: "Falta alumbrado en la calle Duarte",
    category: "alumbrado",
    municipality: "moncion",
    body: "Desde el mes pasado están apagadas casi todas las luces entre el parque y la escuela. De noche la gente camina por el medio de la calle porque no se ve la acera.",
    votes: 11,
    comments: [
      "Mis hijos salen de la escuela nocturna y vienen a oscuras. Urge.",
    ],
    replies: [
      {
        body: "Anotado. Estamos levantando las luminarias dañadas en todo el sector para pedirlas juntas.",
        status: "in_review",
        hoursAgo: 20,
      },
    ],
    photos: [{ file: "alumbrado-1.jpg", alt: "Lámpara de alumbrado público" }],
    hoursAgo: 50,
  },
  {
    title: "La basura no la recogen los martes",
    category: "basura",
    municipality: "sabaneta",
    body: "El camión pasaba martes y viernes, pero hace un mes solo viene los viernes. Para el martes ya hay fundas en la acera y los perros las rompen.",
    votes: 4,
    comments: ["Y con el calor el olor ya no se aguanta."],
    replies: [],
    photos: [
      { file: "basura-1.jpg", alt: "Montón de basura en la calle" },
      { file: "basura-2.jpg", alt: "Basura acumulada" },
    ],
    hoursAgo: 26,
  },
  {
    title: "Hoyos en el camino a la presa",
    category: "vias",
    municipality: "villa-los-almacigos",
    body: "El tramo de tierra que sube a la presa está muy malo después de las lluvias. Los carros pequeños no pasan y las guaguas están dando la vuelta larga.",
    votes: 8,
    comments: ["Ayer un motor se cayó en el más grande, cerca de la curva."],
    replies: [],
    photos: [{ file: "vias-1.jpg", alt: "Hoyo con agua en la calle" }],
    hoursAgo: 10,
  },
  {
    title: "Alcantarilla tapada en la calle Mella",
    category: "agua",
    municipality: "sabaneta",
    body: "Cada vez que llueve el agua sube hasta las casas porque la alcantarilla de la esquina está tapada con basura y lodo. Ya van tres veces este mes.",
    votes: 9,
    comments: [
      "Se mete el agua a mi sala. Hay que limpiarla antes de la temporada de lluvias.",
      "El lodo lleva ahí desde el huracán del año pasado.",
    ],
    replies: [
      {
        body: "Recibimos el caso. La cuadrilla de limpieza pasa por la calle Mella esta semana.",
        status: "in_review",
        hoursAgo: 120,
      },
    ],
    photos: [
      { file: "drenaje-1.jpg", alt: "Desagüe tapado con la calle inundada" },
    ],
    hoursAgo: 150,
  },
  {
    title: "Bache grande frente al liceo",
    category: "vias",
    municipality: "sabaneta",
    body: "Hay un hoyo en la entrada del liceo donde los estudiantes tienen que bajar de la acera. Los motores lo esquivan y casi chocan con los muchachos.",
    votes: 14,
    comments: [
      "Pasé ayer y está peor. Alguien se va a lastimar.",
      "Gracias a quien lo reportó.",
    ],
    replies: [
      {
        body: "Recibido. Programamos el bacheo de la zona escolar para la próxima semana.",
        status: "in_review",
        hoursAgo: 650,
      },
      {
        body: "Se rellenó y compactó el hoyo frente al liceo. Si vuelve a hundirse, avísenos por aquí.",
        status: "resolved",
        hoursAgo: 400,
      },
    ],
    photos: [{ file: "vias-3.jpg", alt: "Hoyo en la carretera" }],
    hoursAgo: 700,
  },
  {
    title: "Luminarias apagadas en el parque central",
    category: "alumbrado",
    municipality: "sabaneta",
    body: "En el parque central hay seis lámparas sin luz. Después de las siete queda a oscuras y las familias ya no se sientan allí.",
    votes: 12,
    comments: [
      "Con el parque oscuro los jóvenes se juntan en la esquina sin luz. Es mejor que lo arreglen.",
    ],
    replies: [
      {
        body: "Hicimos el levantamiento: cuatro lámparas necesitan bombillo y dos, el balasto. Compramos los repuestos y los instalamos esta semana.",
        status: "answered",
        hoursAgo: 250,
      },
    ],
    hoursAgo: 300,
  },
  {
    title: "Fundas de basura junto al mercado",
    category: "basura",
    municipality: "sabaneta",
    body: "Los vendedores dejan las fundas al lado del mercado y el camión no las recoge hasta dos días después. Hay moscas y mal olor para todo el que pasa.",
    votes: 7,
    comments: ["Podrían poner un contenedor más grande ahí."],
    replies: [],
    photos: [
      { file: "basura-4.jpg", alt: "Fundas de basura apiladas en una acera" },
    ],
    hoursAgo: 30,
  },
  {
    title: "Señal de PARE caída en la esquina de la Duarte",
    category: "vias",
    municipality: "sabaneta",
    body: "La señal de PARE se cayó con el viento y nadie la ha vuelto a poner. Ya hubo dos casi accidentes porque los carros no saben quién pasa primero.",
    votes: 5,
    comments: ["Yo vivo en esa esquina y escucho los frenazos todos los días."],
    replies: [],
    photos: [{ file: "senal-1.jpg", alt: "Señal de tránsito dañada" }],
    hoursAgo: 90,
  },
  {
    title: "Bocinas y motores a toda hora en la avenida",
    category: "vias",
    municipality: "sabaneta",
    body: "Desde la medianoche pasan motores sin tubo de escape y bocinas a todo volumen. No se puede dormir en las casas de la avenida.",
    votes: 3,
    comments: ["Pasa sobre todo los fines de semana."],
    replies: [
      {
        body: "El control del ruido de los vehículos le corresponde a la Policía Nacional y a la Digesett, no al ayuntamiento. Les enviamos su queja con la hora y el lugar.",
        status: "rejected",
        hoursAgo: 500,
      },
    ],
    hoursAgo: 520,
  },
  {
    title: "Agua turbia en el barrio La Joya",
    category: "agua",
    municipality: "sabaneta",
    body: "Desde el lunes el agua de la llave sale de color marrón. Los niños no la pueden usar ni para bañarse.",
    votes: 8,
    comments: ["A nosotros también nos pasó, dura unas horas y vuelve."],
    replies: [
      {
        body: "Es sedimento por la limpieza de una tubería. Ya se purgó la línea. Deje correr el agua unos minutos y, si sigue turbia, avísenos.",
        status: "answered",
        hoursAgo: 200,
      },
    ],
    hoursAgo: 220,
  },
  {
    title: "Camión de basura no pasa por el barrio Nuevo",
    category: "basura",
    municipality: "moncion",
    body: "Hace dos semanas que el camión no entra al barrio Nuevo. La gente está quemando la basura en los solares y el humo molesta a los que tienen niños pequeños.",
    votes: 10,
    comments: [
      "Confirmo. Lo mismo en la calle de atrás.",
      "Preferible que lo resuelvan antes de que alguien se enferme.",
    ],
    replies: [
      {
        body: "El camión estuvo averiado. Ya se reparó y se retoma la ruta del barrio Nuevo el miércoles y el sábado.",
        status: "in_review",
        hoursAgo: 100,
      },
    ],
    hoursAgo: 120,
  },
  {
    title: "Hoyos en la calle principal de Monción",
    category: "vias",
    municipality: "moncion",
    body: "La calle que va al hospital tiene hoyos casi cada diez metros. Las ambulancias tienen que ir despacio y los carros se dañan.",
    votes: 13,
    comments: [
      "Esa calle es la más usada del pueblo.",
      "El año pasado la arreglaron y duró dos meses.",
    ],
    replies: [],
    photos: [{ file: "vias-2.jpg", alt: "Hoyo en un camino" }],
    hoursAgo: 60,
  },
  {
    title: "Parque del barrio con bancos rotos y sin luz",
    category: "alumbrado",
    municipality: "moncion",
    body: "En el parque del barrio los bancos están partidos y no hay luz. Es el único lugar donde juegan los niños y de noche da miedo pasar.",
    votes: 6,
    comments: ["Los muchachos juegan pelota ahí. Ojalá lo arreglen."],
    replies: [
      {
        body: "Recibido. Vamos a reparar los bancos y a cambiar las lámparas del parque.",
        status: "in_review",
        hoursAgo: 780,
      },
      {
        body: "Listo: reparamos cuatro bancos y repusimos las lámparas. Gracias por avisar.",
        status: "resolved",
        hoursAgo: 560,
      },
    ],
    photos: [{ file: "parque-1.jpg", alt: "Parque de Monción" }],
    hoursAgo: 800,
  },
  {
    title: "Sin agua en el sector El Mamey",
    category: "agua",
    municipality: "moncion",
    body: "Hace diez días no sube agua al sector El Mamey. Los que tienen tanque ya lo vaciaron y los demás cargan agua desde el río.",
    votes: 16,
    comments: [
      "Nosotros compramos agua cada dos días.",
      "Esperamos respuesta del acueducto.",
    ],
    replies: [
      {
        body: "Pasamos el caso al acueducto. Hay una avería en la línea de conducción.",
        status: "in_review",
        hoursAgo: 580,
      },
      {
        body: "La avería se arregló y el sector El Mamey ya recibe agua. Revisen sus llaves y avísenos si falla otra vez.",
        status: "resolved",
        hoursAgo: 520,
      },
    ],
    hoursAgo: 600,
  },
  {
    title: "Calle inundada cada vez que llueve",
    category: "agua",
    municipality: "moncion",
    body: "En cuanto cae un aguacero la calle de la entrada se convierte en río. El agua no tiene por dónde salir y entra a los negocios.",
    votes: 11,
    comments: ["Falta una cuneta, ahí no hay desagüe."],
    replies: [
      {
        body: "Visitamos la zona. Hace falta un desagüe nuevo; está en el plan de obras del trimestre. Mientras tanto limpiamos la cuneta existente.",
        status: "answered",
        hoursAgo: 380,
      },
    ],
    photos: [{ file: "inund-1.jpg", alt: "Calle inundada" }],
    hoursAgo: 400,
  },
  {
    title: "Contenedor desbordado detrás del colmado",
    category: "basura",
    municipality: "moncion",
    body: "El contenedor que está en el patio de atrás de un colmado se desborda y la basura llega hasta la calle.",
    votes: 2,
    comments: [],
    replies: [
      {
        body: "Ese contenedor es de un negocio privado, por lo que no podemos intervenir. Le avisamos al dueño para que contrate la recogida; si no lo hace, puede reportarlo a Medio Ambiente.",
        status: "rejected",
        hoursAgo: 330,
      },
    ],
    hoursAgo: 350,
  },
  {
    title: "Poste de luz inclinado en la calle Duarte",
    category: "alumbrado",
    municipality: "moncion",
    body: "Un poste de luz quedó inclinado después del aguacero y tiene los cables bajos. Pasan niños por debajo todos los días.",
    votes: 8,
    comments: ["Me preocupa que se caiga. Es peligroso."],
    replies: [],
    hoursAgo: 12,
  },
  {
    title: "Camino de la escuela lleno de lodo",
    category: "vias",
    municipality: "villa-los-almacigos",
    body: "El camino que usan los niños para ir a la escuela se pone intransitable con la lluvia. Llegan embarrados o no van.",
    votes: 9,
    comments: ["Esos niños caminan casi dos kilómetros por ahí."],
    replies: [
      {
        body: "Programamos pasar la motoniveladora y echar material en el tramo más dañado. Les confirmamos la fecha por aquí.",
        status: "in_review",
        hoursAgo: 150,
      },
    ],
    hoursAgo: 200,
  },
  {
    title: "Basura quemada junto al río",
    category: "basura",
    municipality: "villa-los-almacigos",
    body: "Hay un vertedero improvisado en la orilla del río. Queman la basura y el humo y las cenizas bajan al agua.",
    votes: 7,
    comments: ["Esa agua la usan los animales y algunos riegan con ella."],
    replies: [
      {
        body: "Limpiamos el punto y colocamos un letrero. Estamos coordinando con Medio Ambiente para sancionar el vertido y pedimos no volver a arrojar basura allí.",
        status: "answered",
        hoursAgo: 420,
      },
    ],
    hoursAgo: 450,
  },
  {
    title: "Alumbrado del puente peatonal",
    category: "alumbrado",
    municipality: "villa-los-almacigos",
    body: "El puente peatonal no tiene luz y de noche hay que cruzarlo con la linterna del celular.",
    votes: 10,
    comments: ["Mucha gente trabaja de noche y pasa por ahí."],
    replies: [
      {
        body: "Anotado. Vamos a instalar dos lámparas en el puente.",
        status: "in_review",
        hoursAgo: 860,
      },
      {
        body: "Ya quedaron instaladas las dos lámparas del puente. Gracias por avisar.",
        status: "resolved",
        hoursAgo: 700,
      },
    ],
    hoursAgo: 900,
  },
  {
    title: "El tanque de agua del barrio no se llena",
    category: "agua",
    municipality: "villa-los-almacigos",
    body: "El tanque comunitario del barrio no se llena desde hace una semana. Las familias dependen de él.",
    votes: 6,
    comments: ["Ayer nos mandaron un camión cisterna pero no alcanzó."],
    replies: [],
    hoursAgo: 40,
  },
  {
    title: "Drenaje desborda frente a la clínica",
    category: "agua",
    municipality: "villa-los-almacigos",
    body: "El drenaje frente a la clínica rebosa y deja aguas negras en la calle. Pasan enfermos y mujeres embarazadas.",
    votes: 5,
    comments: ["El olor es insoportable."],
    replies: [
      {
        body: "Enviamos un camión para destapar la línea.",
        status: "in_review",
        hoursAgo: 490,
      },
      {
        body: "Se destapó el drenaje y se limpió la calle. Estamos pendientes de que no vuelva a rebosar.",
        status: "resolved",
        hoursAgo: 470,
      },
    ],
    hoursAgo: 500,
  },
  {
    title: "Falta una señal de curva en la carretera",
    category: "vias",
    municipality: "villa-los-almacigos",
    body: "En la curva cerrada de la carretera no hay ninguna señal. De noche los camiones la toman muy rápido.",
    votes: 4,
    comments: ["Ahí ya hubo un accidente el año pasado."],
    replies: [
      {
        body: "Enviamos la solicitud a Obras Públicas, que es quien instala la señalización en carreteras. Les avisamos cuando respondan.",
        status: "in_review",
        hoursAgo: 240,
      },
    ],
    hoursAgo: 260,
  },
];

/** Businesses claimed, one state each, spread over the last weeks. */
const CLAIMS: readonly {
  slug: string;
  municipality: MunicipalityId;
  status: "approved" | "pending" | "rejected";
  hours: string;
  hoursAgo: number;
}[] = [
  {
    slug: "colmado-la-esquina-sabaneta",
    municipality: "sabaneta",
    status: "approved",
    hours: "Lunes a sábado de 7:00 a. m. a 9:00 p. m.",
    hoursAgo: 48,
  },
  {
    slug: "el-patio-restaurant-sabaneta-n4377990193",
    municipality: "sabaneta",
    status: "pending",
    hours: "Todos los días de 11:00 a. m. a 10:00 p. m.",
    hoursAgo: 20,
  },
  {
    slug: "supermercado-leduc-sabaneta-n4740504244",
    municipality: "sabaneta",
    status: "approved",
    hours: "Lunes a domingo de 7:30 a. m. a 8:00 p. m.",
    hoursAgo: 310,
  },
  {
    slug: "hotel-marien-sabaneta-n5047235080",
    municipality: "sabaneta",
    status: "rejected",
    hours: "Abierto las 24 horas",
    hoursAgo: 620,
  },
  {
    slug: "ney-pica-pollo-sabaneta-n4166685557",
    municipality: "sabaneta",
    status: "pending",
    hours: "Martes a domingo de 12:00 m. a 11:00 p. m.",
    hoursAgo: 70,
  },
  {
    slug: "comedor-dona-mercedes-moncion",
    municipality: "moncion",
    status: "pending",
    hours: "Lunes a sábado de 6:30 a. m. a 3:00 p. m.",
    hoursAgo: 48,
  },
  {
    slug: "colmado-radame-moncion-w1359507526",
    municipality: "moncion",
    status: "approved",
    hours: "Todos los días de 6:00 a. m. a 10:00 p. m.",
    hoursAgo: 480,
  },
  {
    slug: "farmacia-moncion-moncion-w1361565200",
    municipality: "moncion",
    status: "approved",
    hours: "Lunes a sábado de 8:00 a. m. a 8:00 p. m.",
    hoursAgo: 220,
  },
  {
    slug: "cerro-bar-moncion-w1359507523",
    municipality: "moncion",
    status: "rejected",
    hours: "Jueves a domingo desde las 5:00 p. m.",
    hoursAgo: 400,
  },
  {
    slug: "colmado-el-manguito-moncion-w1360245106",
    municipality: "moncion",
    status: "pending",
    hours: "Todos los días de 7:00 a. m. a 9:00 p. m.",
    hoursAgo: 30,
  },
  {
    slug: "supermercado-baez-villa-los-almacigos-n4728383989",
    municipality: "villa-los-almacigos",
    status: "approved",
    hours: "Lunes a sábado de 8:00 a. m. a 7:00 p. m.",
    hoursAgo: 260,
  },
  {
    slug: "ferreteria-l-n-villa-los-almacigos-n4728383090",
    municipality: "villa-los-almacigos",
    status: "pending",
    hours: "Lunes a sábado de 8:00 a. m. a 6:00 p. m.",
    hoursAgo: 55,
  },
];

/** Hand-written, human descriptions for the routes the demo shows. */
const ROUTE_DESCRIPTIONS: Record<string, string> = {
  "Camino Los Cacaos":
    "Camino de tierra en Monción, entre cacaotales y conucos, para recorrer a pie. Se camina cómodo en unos 40 minutos. Lleve agua, sombrero y calzado cerrado, vaya temprano y evite los días de lluvia, cuando se pone resbaloso.",
  "Sendero a la Presa de Monción":
    "Sendero que baja hacia la presa de Monción, con vistas del agua y de las lomas. Sale cerca de la carretera de la presa y toma más o menos una hora y cuarto. Lleve agua, protector solar y calzado firme, y mejor vaya por la mañana.",
};

type PhotoSize = { file: string; width: number; height: number };
/** Sizes come from the manifest next to the images, so they cannot drift. */
const PHOTO_SIZES = new Map(
  (
    (await Bun.file(
      new URL(
        "../../apps/web/public/demo/consultations/manifest.json",
        import.meta.url,
      ),
    ).json()) as PhotoSize[]
  ).map((photo) => [photo.file, photo]),
);

/** One audit row per event, keyed by name so a re-run moves it instead of copying it. */
async function audit(
  key: string,
  event: {
    action: string;
    subjectType: string;
    subjectId: string;
    municipalityId: MunicipalityId;
    actorUserId: string | null | undefined;
    createdAt: Date;
  },
) {
  const values = {
    id: uuidFor("audit", key),
    actorUserId: event.actorUserId ?? null,
    action: event.action,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    municipalityId: event.municipalityId,
    metadata: { demo: true },
    createdAt: event.createdAt,
  };
  await db
    .insert(auditEvents)
    .values(values)
    .onConflictDoUpdate({
      target: auditEvents.id,
      set: { createdAt: values.createdAt, actorUserId: values.actorUserId },
    });
}

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "seed-demo invents sign-in-able accounts and never runs in production.",
    );
  }

  // ── People ─────────────────────────────────────────────────────────────
  const userIds = new Map<string, string>();
  const adminId = idFor("user", PEOPLE[0]?.name ?? "");

  for (const [index, person] of PEOPLE.entries()) {
    const id = idFor("user", person.name);
    userIds.set(person.name, id);

    // The same internal placeholder a real phone sign-up gets: never shown,
    // never mailed, and not a verified email.
    const email = `${person.phone.replace(/\D/g, "")}@telefono.rutacibao.local`;
    const role = person.staff === "admin" ? "admin" : "user";
    const account = {
      name: person.name,
      email,
      emailVerified: false,
      phoneNumber: person.phone,
      phoneNumberVerified: true,
      role,
    };

    await db
      .insert(user)
      .values({ id, ...account })
      .onConflictDoUpdate({ target: user.id, set: account });

    // Badges were granted at different times, so the weekly report's "people
    // verified" has something to count in more than one week.
    const verifiedHoursAgo =
      index < FOUNDERS.length ? 200 : 60 + (index % 6) * 150;
    const verifiedAt = person.resident ? ago(verifiedHoursAgo) : null;
    const profile = {
      displayName: person.name,
      staffRole: person.staff,
      municipalityId: person.municipality,
      staffMunicipalityId:
        person.staff === "moderator" ? person.municipality : null,
      residencyVerifiedAt: verifiedAt,
      // The admin's own badge was granted by nobody in this fiction; every
      // other badge names the admin, never the person themselves.
      residencyVerifiedByUserId:
        person.resident && adminId !== id ? adminId : null,
    };
    await db
      .insert(memberProfiles)
      .values({ userId: id, ...profile })
      .onConflictDoUpdate({ target: memberProfiles.userId, set: profile });

    if (verifiedAt) {
      await audit(`resident:${person.name}`, {
        action: "member.residency_verified",
        subjectType: "member",
        subjectId: id,
        municipalityId: person.municipality,
        actorUserId: adminId,
        createdAt: verifiedAt,
      });
    }
  }

  const ids = [...userIds.values()];
  const idOf = (person: Person) => userIds.get(person.name) as string;
  console.log(`people: ${ids.length}`);

  // ── Traffic ────────────────────────────────────────────────────────────
  // Cleared out first: live ones carry timestamps relative to *now*, so a
  // re-run has to replace them rather than leave yesterday's on the map.
  await db
    .delete(trafficReports)
    .where(sql`${trafficReports.reportedByUserId} in ${ids}`);

  let trafficCount = 0;
  let liveTrafficId: string | null = null;

  for (const [index, item] of TRAFFIC.entries()) {
    const neighbours = peopleOf(item.municipality);
    const reporter = neighbours[index % neighbours.length];
    if (!reporter) continue;

    // The same lookup the app itself uses, so a demo stretch follows the road
    // exactly as a real one would.
    const street = item.street ? (await streetAt(item.at)).street : null;
    const created = ago(item.hoursAgo);
    const id = uuidFor("traffic", item.label);
    const ended =
      item.outcome === "cleared"
        ? new Date(created.getTime() + 2 * HOUR)
        : null;

    await db.insert(trafficReports).values({
      id,
      categoryId: item.category,
      municipalityId: item.municipality,
      location: { x: item.at.lng, y: item.at.lat },
      path: street?.path.map((p) => ({ x: p.lng, y: p.lat })) ?? null,
      description: item.description,
      descriptionModerationStatus: "published",
      reportedByUserId: idOf(reporter),
      status: item.outcome,
      resolvedAt:
        item.outcome === "cleared"
          ? item.hoursAgo < 6
            ? ago(1)
            : ended
          : null,
      createdAt: created,
      expiresAt: new Date(
        created.getTime() + TRAFFIC_REPORT_TTL_MINUTES * 60 * 1_000,
      ),
    });

    trafficCount += 1;
    if (item.outcome === "active") liveTrafficId ??= id;

    await audit(`traffic:${item.label}:reported`, {
      action: "traffic.reported",
      subjectType: "traffic",
      subjectId: id,
      municipalityId: item.municipality,
      actorUserId: idOf(reporter),
      createdAt: created,
    });
    if (item.outcome !== "active") {
      await audit(`traffic:${item.label}:${item.outcome}`, {
        action: `traffic.${item.outcome}`,
        subjectType: "traffic",
        subjectId: id,
        municipalityId: item.municipality,
        actorUserId: item.outcome === "cleared" ? idOf(reporter) : null,
        createdAt:
          ended ??
          new Date(created.getTime() + TRAFFIC_REPORT_TTL_MINUTES * 60 * 1_000),
      });
    }

    // Neighbours agreeing, which is what puts faces on the report.
    for (const [n, voter] of pick(
      neighbours,
      index + 1,
      item.confirmations,
      reporter,
    ).entries()) {
      const confirmedAt = new Date(
        Math.min(Date.now(), created.getTime() + (n + 1) * 20 * 60 * 1_000),
      );
      await db
        .insert(trafficConfirmations)
        .values({
          reportId: id,
          userId: idOf(voter),
          verdict: "still",
          weight: CONFIRMATION_WEIGHT,
          createdAt: confirmedAt,
        })
        .onConflictDoNothing();
      await audit(`traffic:${item.label}:confirmed:${voter.name}`, {
        action: "traffic.confirmed",
        subjectType: "traffic",
        subjectId: id,
        municipalityId: item.municipality,
        actorUserId: idOf(voter),
        createdAt: confirmedAt,
      });
    }
  }

  console.log(`traffic: ${trafficCount} reports`);

  // ── Consultations ──────────────────────────────────────────────────────
  let caseCount = 0;
  let commentCount = 0;
  const caseAuthors = new Map<string, string>();

  for (const [index, item] of CASES.entries()) {
    const id = uuidFor("case", item.title);
    const neighbours = peopleOf(item.municipality);
    const authorPerson = neighbours[(index * 3) % neighbours.length];
    if (!authorPerson) continue;
    const author = idOf(authorPerson);
    caseAuthors.set(item.title, author);
    const official = officialOf(item.municipality);

    const created = ago(item.hoursAgo);
    const firstReply = item.replies[0];
    const lastReply = item.replies.at(-1);
    const status: ConsultationStatus = lastReply?.status ?? "open";
    const closed =
      lastReply && ["resolved", "rejected"].includes(lastReply.status);

    const row = {
      slug: slugFor(item.title),
      categoryId: item.category,
      municipalityId: item.municipality,
      title: item.title,
      body: item.body,
      status,
      publicationStatus: "published" as const,
      openedByUserId: author,
      answeredAt: firstReply ? ago(firstReply.hoursAgo) : null,
      closedAt: closed && lastReply ? ago(lastReply.hoursAgo) : null,
      createdAt: created,
    };
    await db
      .insert(consultations)
      .values({ id, ...row })
      .onConflictDoUpdate({ target: consultations.id, set: row });

    caseCount += 1;
    await audit(`case:${item.title}:opened`, {
      action: "consultation.opened",
      subjectType: "consultation",
      subjectId: id,
      municipalityId: item.municipality,
      actorUserId: author,
      createdAt: created,
    });

    // Supporters come from the whole province: a case matters beyond its street.
    const supporters = pick(PEOPLE, index * 5 + 1, item.votes, authorPerson);
    for (const [n, voter] of supporters.entries()) {
      const votedAt = new Date(
        created.getTime() +
          ((Date.now() - created.getTime()) * (n + 1)) /
            (supporters.length + 2),
      );
      await db
        .insert(consultationVotes)
        .values({ consultationId: id, userId: idOf(voter), createdAt: votedAt })
        .onConflictDoUpdate({
          target: [consultationVotes.consultationId, consultationVotes.userId],
          set: { createdAt: votedAt },
        });
      await audit(`case:${item.title}:supported:${voter.name}`, {
        action: "consultation.supported",
        subjectType: "consultation",
        subjectId: id,
        municipalityId: item.municipality,
        actorUserId: idOf(voter),
        createdAt: votedAt,
      });
    }

    // Comments by neighbours of the same municipality, spread between the case
    // and now.
    for (const [n, text] of (item.comments ?? []).entries()) {
      const commenter = pick(
        neighbours,
        index * 2 + n + 1,
        neighbours.length,
        authorPerson,
      )[n % (neighbours.length - 1)];
      if (!commenter) continue;
      const at = new Date(
        created.getTime() +
          ((Date.now() - created.getTime()) * (n + 1)) /
            ((item.comments?.length ?? 0) + 2),
      );
      const commentRow = {
        subjectKind: "consultation" as const,
        subjectId: id,
        municipalityId: item.municipality,
        authorUserId: idOf(commenter),
        body: text,
        status: "published" as const,
        createdAt: at,
        updatedAt: at,
      };
      await db
        .insert(comments)
        .values({ id: uuidFor("comment", `${item.title}:${n}`), ...commentRow })
        .onConflictDoUpdate({ target: comments.id, set: commentRow });
      commentCount += 1;
    }

    // Public demo imagery under /demo/consultations (see CREDITS.md there);
    // a storage key starting with "/" is served as-is by imageUrl().
    await db
      .delete(consultationPhotos)
      .where(eq(consultationPhotos.consultationId, id));
    for (const [position, photo] of (item.photos ?? []).entries()) {
      const size = PHOTO_SIZES.get(photo.file);
      if (!size) throw new Error(`${photo.file} is missing from manifest.json`);
      await db.insert(consultationPhotos).values({
        consultationId: id,
        storageKey: `/demo/consultations/${photo.file}`,
        width: size.width,
        height: size.height,
        alt: photo.alt,
        position,
        uploadedByUserId: author,
      });
    }

    await db
      .delete(consultationResponses)
      .where(eq(consultationResponses.consultationId, id));

    for (const [n, reply] of item.replies.entries()) {
      await db.insert(consultationResponses).values({
        consultationId: id,
        body: reply.body,
        authorUserId: official ? idOf(official) : null,
        statusAfter: reply.status,
        createdAt: ago(reply.hoursAgo),
      });
      if (n === 0) {
        await audit(`case:${item.title}:answered`, {
          action: "consultation.answered",
          subjectType: "consultation",
          subjectId: id,
          municipalityId: item.municipality,
          actorUserId: official ? idOf(official) : null,
          createdAt: ago(reply.hoursAgo),
        });
      }
    }
  }

  console.log(`consultations: ${caseCount}, comments: ${commentCount}`);

  // ── Businesses ─────────────────────────────────────────────────────────
  const claimable = await db
    .select({ id: places.id, slug: places.slug })
    .from(places)
    .where(
      inArray(
        places.slug,
        CLAIMS.map((claim) => claim.slug),
      ),
    );
  const placeBySlug = new Map(claimable.map((place) => [place.slug, place.id]));

  let claimCount = 0;
  for (const [index, claim] of CLAIMS.entries()) {
    const placeId = placeBySlug.get(claim.slug);
    const neighbours = peopleOf(claim.municipality).filter(
      (p) => p.staff === "none",
    );
    const claimant = neighbours[(index * 2) % neighbours.length];
    if (!placeId || !claimant) continue;

    const claimId = uuidFor("claim", claim.slug);
    const submitted = ago(claim.hoursAgo);
    const decided =
      claim.status === "pending" ? null : ago(Math.max(1, claim.hoursAgo - 20));
    const official = officialOf(claim.municipality);

    // Replace whatever claims exist on a place so the one approved owner stays unique.
    await db.delete(businessClaims).where(eq(businessClaims.placeId, placeId));
    await db.insert(businessClaims).values({
      id: claimId,
      placeId,
      claimantUserId: idOf(claimant),
      evidence:
        claim.status === "rejected"
          ? "Trabajo allí, pero el dueño está fuera del país."
          : "Soy el dueño desde hace años, el negocio está a mi nombre y el letrero lleva mi apellido.",
      contactPhone: claimant.phone,
      whatsapp: claimant.phone,
      openingHours: claim.hours,
      status: claim.status,
      reviewedByUserId: decided && official ? idOf(official) : null,
      reviewNote:
        claim.status === "rejected"
          ? "Necesitamos que la solicitud la haga el dueño del negocio o alguien con su autorización escrita."
          : null,
      decidedAt: decided,
      createdAt: submitted,
    });
    claimCount += 1;

    await audit(`claim:${claim.slug}:submitted`, {
      action: "business_claim.submitted",
      subjectType: "business_claim",
      subjectId: claimId,
      municipalityId: claim.municipality,
      actorUserId: idOf(claimant),
      createdAt: submitted,
    });
    if (claim.status === "approved" && decided) {
      await audit(`claim:${claim.slug}:approved`, {
        action: "business_claim.approved",
        subjectType: "business_claim",
        subjectId: claimId,
        municipalityId: claim.municipality,
        actorUserId: official ? idOf(official) : null,
        createdAt: decided,
      });
    }
  }

  console.log(`businesses: ${claimCount} claimed`);

  // ── Trust votes on places ──────────────────────────────────────────────
  let confirmationCount = 0;
  for (const municipality of MUNICIPALITY_IDS) {
    const published = await db
      .select({ id: places.id })
      .from(places)
      .where(
        sql`${places.status} = 'published' and ${places.municipalityId} = ${municipality}`,
      )
      .orderBy(places.slug)
      .limit(10);
    const neighbours = peopleOf(municipality);

    for (const [index, place] of published.entries()) {
      for (const [n, voter] of pick(
        neighbours,
        index,
        2 + (index % 3),
      ).entries()) {
        const at = ago(20 + ((index * 4 + n * 3) % 10) * 95);
        await db
          .insert(placeConfirmations)
          .values({
            placeId: place.id,
            userId: idOf(voter),
            verdict: "exists",
            weight: CONFIRMATION_WEIGHT,
            createdAt: at,
          })
          .onConflictDoUpdate({
            target: [placeConfirmations.placeId, placeConfirmations.userId],
            set: { createdAt: at },
          });
        confirmationCount += 1;
        await audit(`place:${place.id}:confirmed:${voter.name}`, {
          action: "place.confirmed",
          subjectType: "place",
          subjectId: place.id,
          municipalityId: municipality,
          actorUserId: idOf(voter),
          createdAt: at,
        });
      }
    }
  }

  console.log(`places: ${confirmationCount} trust votes`);

  // ── Routes ─────────────────────────────────────────────────────────────
  // Imported routes arrive with whatever text the import wrote; the demo gives
  // the ones it shows a human description, and publishes the pending sendero a
  // resident submitted so the Rutas filter lists more than one.
  let routeCount = 0;
  for (const [name, description] of Object.entries(ROUTE_DESCRIPTIONS)) {
    const updated = await db
      .update(ecoRoutes)
      .set({ description })
      .where(eq(ecoRoutes.name, name))
      .returning({ id: ecoRoutes.id });
    routeCount += updated.length;
  }
  await db
    .update(ecoRoutes)
    .set({ status: "published", reviewedAt: ago(100) })
    .where(
      sql`${ecoRoutes.name} = 'Sendero a la Presa de Monción' and ${ecoRoutes.status} = 'pending'`,
    );
  console.log(`routes: ${routeCount} described`);

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
        params: { title: CASES[0]?.title ?? "" },
        href: appTargetHref({
          kind: "consultation",
          ref: slugFor(CASES[0]?.title ?? ""),
        }),
        createdAt: ago(6),
      },
      {
        id: randomUUID(),
        userId: reader,
        messageKey: "notifications.trafficNearby",
        params: { description: "Vía bloqueada: camión atravesado" },
        href: liveTrafficId
          ? appTargetHref({ kind: "traffic", ref: liveTrafficId })
          : null,
        createdAt: ago(2),
      },
      {
        id: randomUUID(),
        userId: reader,
        messageKey: "notifications.placeApproved",
        params: { name: "Presa de Monción" },
        href: appTargetHref({ kind: "place", ref: "presa-de-moncion" }),
        readAt: ago(20),
        createdAt: ago(24),
      },
    ]);
  }

  // Residents hear back about their own cases, and claimants about theirs.
  let notificationCount = 3;
  for (const item of CASES) {
    const author = caseAuthors.get(item.title);
    const lastReply = item.replies.at(-1);
    if (!author || !lastReply || author === reader) continue;
    await db
      .delete(notifications)
      .where(eq(notifications.dedupeKey, `demo:case:${item.title}`));
    await db.insert(notifications).values({
      id: randomUUID(),
      userId: author,
      dedupeKey: `demo:case:${item.title}`,
      messageKey:
        lastReply.status === "answered" || lastReply.status === "resolved"
          ? "notifications.consultationAnswered"
          : "notifications.consultationStatusChanged",
      params: { title: item.title, status: lastReply.status },
      href: appTargetHref({ kind: "consultation", ref: slugFor(item.title) }),
      readAt: lastReply.hoursAgo > 300 ? ago(lastReply.hoursAgo - 4) : null,
      createdAt: ago(lastReply.hoursAgo),
    });
    notificationCount += 1;
  }

  // ── Children never predate their parent ────────────────────────────────
  // A demo case is re-dated relative to "now" on every run, so anything an
  // earlier run (or someone clicking around the demo) attached to the same
  // row can end up older than it. Pull those forward to just after the parent.
  const after = sql`least(now(), parent.created_at + interval '1 hour')`;
  await db.execute(sql`
    update comments set created_at = ${after}, updated_at = ${after}
      from consultations parent
     where comments.subject_kind = 'consultation' and comments.subject_id = parent.id
       and comments.created_at < parent.created_at`);
  await db.execute(sql`
    update consultation_votes set created_at = ${after}
      from consultations parent
     where consultation_votes.consultation_id = parent.id
       and consultation_votes.created_at < parent.created_at`);
  await db.execute(sql`
    update consultation_responses set created_at = ${after}
      from consultations parent
     where consultation_responses.consultation_id = parent.id
       and consultation_responses.created_at < parent.created_at`);
  await db.execute(sql`
    update traffic_confirmations set created_at = ${after}
      from traffic_reports parent
     where traffic_confirmations.report_id = parent.id
       and traffic_confirmations.created_at < parent.created_at`);
  await db.execute(sql`
    update audit_events set created_at = ${after}
      from consultations parent
     where audit_events.subject_type = 'consultation' and audit_events.subject_id = parent.id::text
       and audit_events.created_at < parent.created_at`);
  await db.execute(sql`
    update audit_events set created_at = ${after}
      from traffic_reports parent
     where audit_events.subject_type = 'traffic' and audit_events.subject_id = parent.id::text
       and audit_events.created_at < parent.created_at`);

  console.log(`notifications: ${notificationCount}`);
  console.log(
    "\ndemo data ready. Sign in by phone (code = LOCAL_DEMO_OTP when the number is in LOCAL_DEMO_PHONES):",
  );
  for (const person of PEOPLE) {
    const role =
      person.staff === "none"
        ? person.resident
          ? "resident"
          : "member"
        : person.staff;
    console.log(
      `  ${formatPhone(person.phone)}  ${role.padEnd(9)}  ${person.name} (${person.municipality})`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

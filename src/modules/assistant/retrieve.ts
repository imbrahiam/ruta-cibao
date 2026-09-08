import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, municipalities, places } from "@/db/schema";
import { embedQuery } from "@/lib/ai/embeddings";
import { placeCoverUrl } from "@/modules/places/photos";

/**
 * Finding the places a question is about.
 *
 * Two retrievers, fused, because they fail in opposite directions. The vector
 * search understands that "dónde consigo agua" is about a river and an aqueduct
 * even though it shares no words with either; it is also confidently wrong
 * about proper nouns, and it is blind to anything published in the last minute
 * because the backfill has not reached it. Trigram matching is the reverse: it
 * nails "Moncioón" typed with a wobble and knows nothing about meaning.
 *
 * Reciprocal rank fusion rather than score blending: the two produce numbers on
 * incomparable scales — cosine distance and word similarity — and normalising
 * them against each other would be inventing a relationship that is not there.
 * Ranks are comparable by construction.
 */
export type RetrievedPlace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  municipalityName: string;
  lng: number;
  lat: number;
  /** First published photo, or null when the place has none. */
  photo: string | null;
};

/** Damps the contribution of low ranks; 60 is the value the RRF paper uses. */
const RRF_K = 60;

/**
 * How similar is similar enough.
 *
 * e5 compresses its scores — measured against this database, an unrelated place
 * still scores 0.74 and a good match scores 0.85 — so "nearest" is never a
 * useful answer on its own. Without a floor, "¿dónde como algo?" returns the
 * hospital, the town hall and the dam, ranked, as if they were answers.
 *
 * Two gates, both measured rather than guessed. The floor is what a real match
 * clears (`atención médica` → hospital, 0.849) and a non-match does not
 * (`comer algo` → best 0.757). The margin then drops anything the top result
 * left well behind, because a list where only the first row is relevant reads
 * as four wrong answers with a right one hidden in it.
 */
const MIN_SIMILARITY = 0.8;
const SIMILARITY_MARGIN = 0.02;

/**
 * A hard cap on the vector side, on top of the two gates.
 *
 * Deliberately a constant rather than something derived from the score spread.
 * A distinctiveness test — "is the top result far enough above the others" —
 * scores better against the handful of places seeded today and behaves
 * differently once there are hundreds, because the runners-up get closer as
 * the map fills. A fixed cap is worse on paper and does not rot.
 */
const MAX_SEMANTIC_HITS = 3;

const SELECTION = {
  id: places.id,
  slug: places.slug,
  name: places.name,
  description: places.description,
  address: places.address,
  location: places.location,
  categoryName: categories.name,
  categoryColor: categories.color,
  categoryIcon: categories.icon,
  municipalityName: municipalities.name,
};

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  location: { x: number; y: number };
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  municipalityName: string;
};

function toPlace(row: Row, photo: string | null): RetrievedPlace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    address: row.address,
    categoryName: row.categoryName,
    categoryColor: row.categoryColor,
    categoryIcon: row.categoryIcon,
    municipalityName: row.municipalityName,
    lng: row.location.x,
    lat: row.location.y,
    photo,
  };
}

async function byMeaning(question: string, limit: number): Promise<Row[]> {
  const vector = await embedQuery(question);
  const literal = `[${vector.join(",")}]`;

  const rows = await db
    .select({
      ...SELECTION,
      similarity: sql<number>`1 - (${places.embedding} <=> ${literal}::vector)`,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .where(and(eq(places.status, "published"), isNotNull(places.embedding)))
    .orderBy(sql`${places.embedding} <=> ${literal}::vector`)
    .limit(limit);

  const best = rows[0]?.similarity ?? 0;
  if (best < MIN_SIMILARITY) return [];

  return rows
    .filter((row) => row.similarity >= best - SIMILARITY_MARGIN)
    .slice(0, MAX_SEMANTIC_HITS);
}

async function byWords(question: string, limit: number): Promise<Row[]> {
  return db
    .select(SELECTION)
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .where(
      and(
        eq(places.status, "published"),
        sql`word_similarity(unaccent(lower(${question})), unaccent(lower(${places.name} || ' ' || ${categories.name} || ' ' || coalesce(${places.description}, '')))) > 0.28`,
      ),
    )
    .orderBy(
      sql`word_similarity(unaccent(lower(${question})), unaccent(lower(${places.name}))) desc`,
    )
    .limit(limit);
}

export async function retrievePlaces(
  question: string,
  limit = 4,
): Promise<RetrievedPlace[]> {
  const trimmed = question.trim();
  if (trimmed.length < 2) return [];

  // The vector side can fail hard — a missing model download on a machine with
  // no network — and when it does the assistant should get worse, not break.
  const [meaning, words] = await Promise.all([
    byMeaning(trimmed, limit * 2).catch((error) => {
      console.error("semantic retrieval failed:", error);
      return [] as Row[];
    }),
    byWords(trimmed, limit * 2),
  ]);

  const scores = new Map<string, { row: Row; score: number }>();
  for (const list of [meaning, words]) {
    list.forEach((row, index) => {
      const existing = scores.get(row.id);
      const contribution = 1 / (RRF_K + index + 1);
      if (existing) {
        existing.score += contribution;
        return;
      }
      scores.set(row.id, { row, score: contribution });
    });
  }

  const shortlisted = [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // A cover photo is what makes a suggested place recognisable, and at most
  // `limit` signed URLs are minted per question. A place without photos keeps
  // null and the card falls back to its category icon.
  const covers = await Promise.all(
    shortlisted.map((entry) =>
      placeCoverUrl(db, entry.row.id).catch(() => null),
    ),
  );

  return shortlisted.map((entry, index) =>
    toPlace(entry.row, covers[index] ?? null),
  );
}

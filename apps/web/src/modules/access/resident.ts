import { sql } from "drizzle-orm";
import { memberProfiles } from "@/db/schema";

/**
 * Whether a joined profile holds the in-person municipal resident badge.
 *
 * False for a missing profile (left joins), so a deleted author never reads
 * as verified. Context for readers and moderators; it never weighs a tally.
 */
export const residentVerified = sql<boolean>`(${memberProfiles.residencyVerifiedAt} is not null)`;

/**
 * Barrel for every table in the database.
 *
 * Schemas are split by bounded context (auth, places, routes, traffic,
 * consultations, reports) and re-exported here so Drizzle and the Better Auth
 * adapter both see one complete schema object.
 */
export * from "./auth";

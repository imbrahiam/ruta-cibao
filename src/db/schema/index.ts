/**
 * Barrel for every table in the database.
 *
 * Schemas are split by bounded context and re-exported here so Drizzle and the
 * Better Auth adapter both see one complete schema object.
 */
export * from "./auth";
export * from "./geography";
export * from "./members";
export * from "./platform";

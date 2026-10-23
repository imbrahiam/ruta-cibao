/**
 * Barrel for every table in the database.
 *
 * Schemas are split by bounded context and re-exported here so Drizzle and the
 * Better Auth adapter both see one complete schema object.
 */
export * from "./auth";
export * from "./businesses";
export * from "./catalog";
export * from "./consultations";
export * from "./deletion";
export * from "./geography";
export * from "./members";
export * from "./passport";
export * from "./places";
export * from "./platform";
export * from "./realtime";
export * from "./reports";
export * from "./routes";
export * from "./safety";
export * from "./traffic";

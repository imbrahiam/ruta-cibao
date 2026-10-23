import { asc } from "drizzle-orm";
import { municipalities } from "@/db/schema";
import { impl } from "../base";

/** Public: the onboarding form needs this before anyone has signed in. */
export const municipalitiesRouter = {
  list: impl.municipalities.list.handler(async ({ context }) => {
    const rows = await context.db
      .select({
        id: municipalities.id,
        name: municipalities.name,
        center: municipalities.center,
      })
      .from(municipalities)
      .orderBy(asc(municipalities.name));

    return rows.map((municipality) => ({
      id: municipality.id,
      name: municipality.name,
      center: municipality.center
        ? {
            lng: municipality.center.x,
            lat: municipality.center.y,
          }
        : null,
    }));
  }),
};

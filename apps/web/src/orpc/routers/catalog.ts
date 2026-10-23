import { asc, eq } from "drizzle-orm";
import { categories } from "@/db/schema";
import { saveCategory } from "@/modules/catalog/save-category";
import { admin, impl } from "../base";

export const catalogRouter = {
  list: impl.catalog.list
    .use(admin)
    .handler(({ context, input }) =>
      context.db
        .select()
        .from(categories)
        .where(eq(categories.kind, input.kind))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
    ),
  save: impl.catalog.save
    .use(admin)
    .handler(({ context, input }) => saveCategory(context.viewer, input)),
};

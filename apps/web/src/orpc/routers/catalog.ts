import { openapi } from "@orpc/openapi";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { categories } from "@/db/schema";
import { categoryKinds, saveCategoryInput } from "@/modules/catalog/contracts";
import { saveCategory } from "@/modules/catalog/save-category";
import { adminProcedure } from "../base";

export const catalogRouter = {
  list: adminProcedure
    .meta(openapi({ method: "GET", path: "/admin/categories" }))
    .input(z.object({ kind: categoryKinds }))
    .handler(({ context, input }) =>
      context.db
        .select()
        .from(categories)
        .where(eq(categories.kind, input.kind))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
    ),
  save: adminProcedure
    .meta(openapi({ method: "POST", path: "/admin/categories" }))
    .input(saveCategoryInput)
    .output(z.object({ id: z.string() }))
    .handler(({ context, input }) => saveCategory(context.viewer, input)),
};

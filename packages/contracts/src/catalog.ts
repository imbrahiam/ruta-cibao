import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const categoryKinds = z.enum([
  "place",
  "business",
  "route",
  "traffic",
  "consultation",
]);
export const editableCategory = z.object({
  id: z.string(),
  kind: categoryKinds,
  name: z.string().trim().min(2).max(80),
  icon: z.enum([
    "map-pin",
    "mountain",
    "route",
    "store",
    "droplets",
    "triangle-alert",
    "construction",
    "trees",
    "messages-square",
  ]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  severity: z.enum(["blocking", "partial", "minor"]).nullable(),
  sortOrder: z.number().int().min(0).max(1000),
  isActive: z.boolean(),
});
export const saveCategoryInput = editableCategory
  .omit({ id: true })
  .extend({
    requestId: z.uuid(),
    id: z.string().min(1).max(100).optional(),
  })
  .refine((value) => value.kind !== "traffic" || value.severity !== null, {
    path: ["severity"],
  });
export type SaveCategoryInput = z.infer<typeof saveCategoryInput>;

/** A category as the public forms and legends need it. */
export const categorySummary = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
});

export const listCategoriesInput = z.object({ kind: categoryKinds });

/** A stored category row, as the admin catalog lists it. */
export const categoryRecord = z.object({
  id: z.string(),
  kind: categoryKinds,
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  severity: z.enum(["blocking", "partial", "minor"]).nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export const saveCategoryOutput = z.object({ id: z.string() });

export const catalogContract = {
  list: oc
    .meta(openapi({ method: "GET", path: "/admin/categories" }))
    .input(listCategoriesInput)
    .output(z.array(categoryRecord)),
  save: oc
    .meta(openapi({ method: "POST", path: "/admin/categories" }))
    .input(saveCategoryInput)
    .output(saveCategoryOutput),
};

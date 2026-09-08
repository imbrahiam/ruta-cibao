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

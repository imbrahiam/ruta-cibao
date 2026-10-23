import { ORPCError } from "@orpc/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { categories } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import type { ModeratorViewer } from "@/modules/access/permissions";
import type { SaveCategoryInput } from "./contracts";

export async function saveCategory(
  viewer: ModeratorViewer,
  input: SaveCategoryInput,
) {
  const { result } = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      // Serializes taxonomy edits, including differently cased duplicate names.
      await tx.execute(sql`select pg_advisory_xact_lock(713209)`);
      const id = input.id ?? crypto.randomUUID();
      const [duplicate] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.kind, input.kind),
            sql`lower(${categories.name}) = lower(${input.name})`,
            ne(categories.id, id),
          ),
        )
        .limit(1);
      if (duplicate)
        throw new ORPCError("CONFLICT", {
          data: { reason: "duplicate_category" },
        });
      const values = {
        name: input.name,
        icon: input.icon,
        color: input.color,
        severity: input.kind === "traffic" ? input.severity : null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      };
      if (input.id) {
        const [updated] = await tx
          .update(categories)
          .set(values)
          .where(and(eq(categories.id, id), eq(categories.kind, input.kind)))
          .returning({ id: categories.id });
        if (!updated) throw new ORPCError("NOT_FOUND");
      } else {
        await tx.insert(categories).values({ id, kind: input.kind, ...values });
      }
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: input.id ? "category.updated" : "category.created",
          subjectType: "category",
          subjectId: id,
          metadata: { kind: input.kind, isActive: input.isActive },
        },
        tx,
      );
      return { id };
    },
  });
  return result;
}

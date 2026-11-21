"use client";

import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, FolderCog, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { ErrorPanel } from "@/components/admin/error-panel";
import { catalogKind, catalogOptions } from "@/components/admin/list-queries";
import {
  AdminEmpty,
  AdminPageHeader,
  InboxList,
  InboxRow,
} from "@/components/admin/page-frame";
import { QueryState } from "@/components/admin/query-state";
import { useStaff } from "@/components/admin/staff-context";
import { StatusIndicator } from "@/components/admin/status-indicator";
import { useUrlParam } from "@/components/admin/use-url-param";
import { CategoryLead } from "@/components/category/category-pin";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CategoryForm,
  type CategoryKind,
  type CategoryRecord,
} from "./category-form";

const KINDS: readonly CategoryKind[] = [
  "place",
  "business",
  "route",
  "traffic",
  "consultation",
];

/** Placeholder rows in the shape of the list: pin, name, order. */
function CategorySkeleton() {
  return (
    <ul className="flex flex-col">
      {Array.from({ length: 6 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <li key={index} className="flex min-h-16 items-center gap-3 py-3">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** What a moderator sees: the same refusal the server would give. */
const REFUSED = new ORPCError("FORBIDDEN");

/**
 * The taxonomy behind the forms and the map, for province administrators.
 *
 * Only administrators get past the server, and a moderator is told so here
 * before any request is made. The kind in view lives in the address.
 */
export function CategoryManager() {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cat");
  const { staffRole } = useStaff();
  const isAdmin = staffRole === "admin";
  const [rawKind, setKind] = useUrlParam("kind", "place");
  const kind = catalogKind(rawKind);
  const [editing, setEditing] = useState<CategoryRecord | "new" | null>(null);

  const list = useQuery({
    ...catalogOptions(kind),
    enabled: isAdmin,
  });

  // The other kinds are one small request each: have them ready, so a tab
  // opens with its rows rather than a placeholder.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isAdmin) return;
    for (const other of KINDS) {
      void queryClient.prefetchQuery(catalogOptions(other));
    }
  }, [isAdmin, queryClient]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={t("categories")} />
        <ErrorPanel error={REFUSED} />
      </div>
    );
  }

  const traffic = kind === "traffic";

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={t("categories")}
        actions={
          <Button id="cat-new" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("newCategory")}
          </Button>
        }
      />

      <Tabs
        value={kind}
        onValueChange={(value) => {
          setEditing(null);
          setKind(value);
        }}
        className="min-w-0"
      >
        <TabsList
          variant="pill"
          aria-label={c("kindGroup")}
          className="scrollbar-none max-w-full justify-start overflow-x-auto"
        >
          {KINDS.map((value) => (
            <TabsTrigger key={value} value={value} className="flex-none">
              {t(value)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QueryState query={list} skeleton={<CategorySkeleton />}>
        {(categories) =>
          categories.length === 0 ? (
            <AdminEmpty icon={FolderCog} title={c("empty")} />
          ) : (
            <InboxList label={c("kindGroup")} className="max-w-5xl">
              {categories.map((record) => (
                <InboxRow
                  key={record.id}
                  dense
                  title={record.name}
                  onOpen={() => setEditing(record)}
                  openId={`cat-edit-${record.id}`}
                  openLabel={c("editFor", { name: record.name })}
                  lead={
                    <CategoryLead icon={record.icon} color={record.color} />
                  }
                  badge={
                    // Active is the normal case and goes unsaid.
                    record.isActive ? null : (
                      <StatusIndicator icon={EyeOff}>
                        {c("inactive")}
                      </StatusIndicator>
                    )
                  }
                  // The rows already stand in their order; only what differs
                  // between them (a traffic severity) is said.
                  meta={
                    traffic && record.severity ? t(record.severity) : undefined
                  }
                />
              ))}
            </InboxList>
          )
        }
      </QueryState>

      {editing ? (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          kind={kind}
          record={editing === "new" ? undefined : editing}
          onClose={() => {
            // The dialog has no trigger element, so put the keyboard back on
            // the control that opened it.
            const openerId =
              editing === "new" ? "cat-new" : `cat-edit-${editing.id}`;
            setEditing(null);
            requestAnimationFrame(() =>
              document.getElementById(openerId)?.focus(),
            );
          }}
        />
      ) : null}
    </div>
  );
}

"use client";

import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderCog, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { ErrorPanel } from "@/components/admin/error-panel";
import { catalogKind, catalogOptions } from "@/components/admin/list-queries";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTableCard,
} from "@/components/admin/page-frame";
import { QueryState } from "@/components/admin/query-state";
import { TableRowsSkeleton } from "@/components/admin/skeletons";
import { useStaff } from "@/components/admin/staff-context";
import { StatusIndicator } from "@/components/admin/status-indicator";
import { useUrlParam } from "@/components/admin/use-url-param";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CategoryForm,
  CategoryIcon,
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

/** The column heads, shared by the table and its placeholder so they never differ. */
function CategoryHead({ traffic }: { traffic: boolean }) {
  const t = useTranslations("admin");
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="h-10 text-xs text-muted-foreground">
          {t("name")}
        </TableHead>
        <TableHead className="hidden h-10 text-xs text-muted-foreground sm:table-cell">
          {t("icon")}
        </TableHead>
        {traffic ? (
          <TableHead className="hidden h-10 text-xs text-muted-foreground md:table-cell">
            {t("severity")}
          </TableHead>
        ) : null}
        <TableHead className="hidden h-10 text-right text-xs text-muted-foreground sm:table-cell">
          {t("sortOrder")}
        </TableHead>
        <TableHead className="h-10 text-xs text-muted-foreground">
          {t("status")}
        </TableHead>
        <TableHead className="h-10 w-px">
          <span className="sr-only">{t("editCategory")}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Placeholder rows: name with its colour dot, icon, severity, order, status, edit. */
function categorySkeleton(traffic: boolean) {
  const cells = [
    { bars: ["h-5 w-40"] },
    { cell: "hidden sm:table-cell", bars: ["h-4 w-24"] },
    ...(traffic ? [{ cell: "hidden md:table-cell", bars: ["h-4 w-16"] }] : []),
    { cell: "hidden sm:table-cell", bars: ["ml-auto h-4 w-6"] },
    { bars: ["h-5 w-16"] },
    { bars: ["ml-auto h-9 w-16"] },
  ];
  return (
    <AdminTableCard>
      <Table>
        <CategoryHead traffic={traffic} />
        <TableBody>
          <TableRowsSkeleton rows={5} rowClassName="h-12" cells={cells} />
        </TableBody>
      </Table>
    </AdminTableCard>
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

      <QueryState query={list} skeleton={categorySkeleton(traffic)}>
        {(categories) =>
          categories.length === 0 ? (
            <AdminEmpty icon={FolderCog} title={c("empty")} />
          ) : (
            <AdminTableCard>
              <Table>
                <CategoryHead traffic={traffic} />
                <TableBody>
                  {categories.map((record) => (
                    <TableRow key={record.id} className="h-12">
                      <TableCell className="py-0">
                        <span className="flex items-center gap-3 font-medium">
                          <span
                            aria-hidden
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: record.color }}
                          />
                          <span className="truncate" title={record.name}>
                            {record.name}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden py-0 text-muted-foreground sm:table-cell">
                        <CategoryIcon name={record.icon} />
                      </TableCell>
                      {traffic ? (
                        <TableCell className="hidden py-0 md:table-cell">
                          {record.severity ? (
                            t(record.severity)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell className="hidden py-0 text-right tabular-nums sm:table-cell">
                        {record.sortOrder}
                      </TableCell>
                      <TableCell className="py-0">
                        <StatusIndicator
                          tone={record.isActive ? "success" : "neutral"}
                        >
                          {record.isActive ? t("active") : c("inactive")}
                        </StatusIndicator>
                      </TableCell>
                      <TableCell className="py-0 text-right">
                        <Button
                          variant="ghost"
                          aria-label={c("editFor", { name: record.name })}
                          id={`cat-edit-${record.id}`}
                          onClick={() => setEditing(record)}
                        >
                          {t("editCategory")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableCard>
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

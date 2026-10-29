"use client";

import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { FolderCog, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { ErrorPanel } from "@/components/admin/error-panel";
import { catalogKind, catalogOptions } from "@/components/admin/list-queries";
import { AdminPageHeader, AdminTableCard } from "@/components/admin/page-frame";
import { useStaff } from "@/components/admin/staff-context";
import { useUrlParam } from "@/components/admin/use-url-param";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Placeholder } from "@/components/ui/loading";
import { Chip, Tag } from "@/components/ui/tag";
import { cx } from "@/lib/web/cx";
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

/** What a moderator sees: the same refusal the server would give. */
const REFUSED = new ORPCError("FORBIDDEN");

const COLUMNS =
  "md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_7rem_4.5rem_7rem_6rem]";
const COLUMNS_TRAFFIC =
  "md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_7rem_8rem_4.5rem_7rem_6rem]";

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
  const [editing, setEditing] = useState<string | null>(null);

  const list = useQuery({
    ...catalogOptions(kind),
    enabled: isAdmin,
  });

  const header = (
    <AdminPageHeader title={t("categories")} description={c("intro")} />
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorPanel error={REFUSED} />
      </div>
    );
  }

  // Put the keyboard back where the form was opened once it closes.
  const close = (triggerId: string) => {
    setEditing(null);
    requestAnimationFrame(() => document.getElementById(triggerId)?.focus());
  };

  const traffic = kind === "traffic";
  const columns = traffic ? COLUMNS_TRAFFIC : COLUMNS;

  return (
    <div className="flex flex-col gap-6">
      {header}

      <fieldset className="scrollbar-none -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <legend className="sr-only">{c("kindGroup")}</legend>
        {KINDS.map((value) => (
          <Chip
            key={value}
            selected={kind === value}
            onClick={() => {
              setEditing(null);
              setKind(value);
            }}
          >
            {t(value)}
          </Chip>
        ))}
      </fieldset>

      <div>
        <Button
          id="cat-new"
          variant="accent"
          size="lg"
          className="max-sm:w-full"
          aria-expanded={editing === "new"}
          aria-controls="cat-form-new"
          disabled={editing === "new"}
          onClick={() => setEditing("new")}
        >
          <Plus aria-hidden />
          {t("newCategory")}
        </Button>
      </div>

      {editing === "new" ? (
        <div id="cat-form-new">
          <CategoryForm kind={kind} onClose={() => close("cat-new")} />
        </div>
      ) : null}

      {list.isPending ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{t("loading")}</span>
          {[0, 1, 2].map((key) => (
            <Placeholder key={key} className="h-28 md:h-14" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorPanel error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState icon={FolderCog} title={c("empty")} />
      ) : (
        <div aria-busy={list.isFetching}>
          <AdminTableCard>
            <div
              aria-hidden
              className={cx(
                "t-label hidden gap-4 border-b border-line bg-paper-2 px-4 py-2.5 text-ink-3 md:grid",
                columns,
              )}
            >
              <span>{t("name")}</span>
              <span>{t("icon")}</span>
              <span>{t("color")}</span>
              {traffic ? <span>{t("severity")}</span> : null}
              <span>{t("sortOrder")}</span>
              <span>{t("status")}</span>
              <span />
            </div>
            <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-line">
              {list.data.map((record) => (
                <CategoryRow
                  key={record.id}
                  record={record}
                  columns={columns}
                  open={editing === record.id}
                  onOpen={() => setEditing(record.id)}
                  onClose={() => close(`cat-edit-${record.id}`)}
                />
              ))}
            </ul>
          </AdminTableCard>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  record,
  columns,
  open,
  onOpen,
  onClose,
}: {
  record: CategoryRecord;
  columns: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cat");
  // Labels are for the phone's cards and for screen readers; the wide layout
  // has a header row that says the same.
  const label = "t-small text-ink-3 md:sr-only";

  return (
    <li className="rounded-card bg-card shadow-ring md:rounded-none md:shadow-none">
      <div
        className={cx(
          "grid grid-cols-2 items-center gap-x-4 gap-y-2 p-4 md:py-3",
          columns,
        )}
      >
        <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
          <span
            aria-hidden
            className="size-6 shrink-0 rounded-full shadow-ring"
            style={{ backgroundColor: record.color }}
          />
          <span className="text-[16px] leading-snug font-medium text-ink">
            {record.name}
          </span>
        </div>
        <p className="t-small flex items-center gap-1.5 text-ink">
          <span className={label}>{t("icon")}:</span>
          <CategoryIcon name={record.icon} />
        </p>
        <p className="t-small flex gap-1.5 text-ink">
          <span className={label}>{t("color")}:</span>
          <span className="font-mono uppercase">{record.color}</span>
        </p>
        {record.kind === "traffic" ? (
          <p className="t-small flex gap-1.5 text-ink">
            <span className={label}>{t("severity")}:</span>
            {record.severity ? t(record.severity) : t("none")}
          </p>
        ) : null}
        <p className="t-small flex gap-1.5 text-ink">
          <span className={label}>{t("sortOrder")}:</span>
          <span className="tabular">{record.sortOrder}</span>
        </p>
        <div>
          <Tag tone={record.isActive ? "success" : "neutral"}>
            {record.isActive ? t("active") : c("inactive")}
          </Tag>
        </div>
        <div className="col-span-2 md:col-span-1 md:justify-self-end">
          <Button
            id={`cat-edit-${record.id}`}
            size="sm"
            className="max-md:w-full max-md:min-h-11"
            aria-expanded={open}
            aria-controls={`cat-form-${record.id}`}
            aria-label={c("editFor", { name: record.name })}
            disabled={open}
            onClick={onOpen}
          >
            {t("editCategory")}
          </Button>
        </div>
      </div>
      {open ? (
        <div id={`cat-form-${record.id}`} className="p-2 pt-0 md:p-3 md:pt-0">
          <CategoryForm kind={record.kind} record={record} onClose={onClose} />
        </div>
      ) : null}
    </li>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { OpenConsultationDrawer } from "@/components/consultations/open-consultation-drawer";
import { StatusBadge } from "@/components/consultations/status-badge";
import { Button } from "@/components/ui/button";
import { groupByRecency } from "@/components/ui-patterns/date-groups";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import {
  FilterPill,
  FilterPillRow,
} from "@/components/ui-patterns/filter-pill";
import {
  ListRow,
  ListRowSkeleton,
  RowPictogram,
} from "@/components/ui-patterns/list-row";
import { Segmented } from "@/components/ui-patterns/segmented";
import { categoryIcon } from "@/lib/map/category-icons";
import { orpc } from "@/lib/orpc";

/**
 * Every case the province has open, and the ones you opened.
 *
 * Public, and that is the point of the screen rather than a permission
 * oversight. A resident about to report the same broken pipe as four neighbours
 * should see those four first, and an ayuntamiento answering in public answers
 * to more than the one person who wrote in.
 *
 * A ruled list grouped by how recent, because a case is something you look up
 * rather than choose by its picture: the topic's pictogram, the resident's own
 * words, the town and age, and where it stands at the edge.
 *
 * The filters live in the URL, like the map's, so a link to "las consultas de
 * agua" is a link somebody can send.
 */
export function ConsultationList() {
  const t = useTranslations("consultations");
  const groupT = useTranslations("lists");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { viewer } = useAuth();

  const [scope, setScope] = useQueryState(
    "ver",
    parseAsString.withDefault("todos").withOptions({ shallow: true }),
  );
  const [category, setCategory] = useQueryState(
    "tema",
    parseAsString.withDefault("").withOptions({ shallow: true }),
  );
  const [opening, setOpening] = useState(false);

  const { data: categories = [] } = useQuery(
    orpc.consultations.categories.queryOptions(),
  );
  const { data: municipalities = [] } = useQuery(
    orpc.municipalities.list.queryOptions(),
  );
  // A case is filed against the citizen's *own* ayuntamiento — the one the
  // civil registry put on their profile — not against whichever municipality
  // happens to be first in the list they are reading.
  const home =
    municipalities.find(
      (municipality) => municipality.id === viewer?.municipalityId,
    ) ?? null;

  const mine = scope === "mios";
  const query = useQuery(
    orpc.consultations.browse.queryOptions({
      input: { mine, category, limit: 24 },
    }),
  );

  const items = query.data?.items ?? [];
  const groups = groupByRecency(items, (item) => item.createdAt, now);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* The large-title pattern: the action sits beside the title, on its
          first line, rather than wrapping alone under it on a phone. */}
      <header className="flex items-start justify-between gap-4 max-[380px]:flex-col max-[380px]:gap-3">
        <h1 className="page-title min-w-0">{t("title")}</h1>
        <Button
          className="mt-1 h-11 shrink-0 rounded-[14px] px-4 text-[15px] max-[380px]:mt-0 sm:mt-1.5 sm:px-5"
          onClick={() => setOpening(true)}
        >
          <Plus className="size-4" aria-hidden />
          {t("open")}
        </Button>
      </header>

      {viewer && viewer.kind !== "anonymous" && (
        <Segmented
          className="sm:max-w-xs"
          label={t("scope")}
          value={mine ? "mios" : "todos"}
          onChange={(value) => void setScope(value || null)}
          options={[
            { value: "todos", label: t("all") },
            { value: "mios", label: t("mine") },
          ]}
        />
      )}

      {/* The taxonomy as pills rather than a select: there are a handful,
          they are the fastest way to narrow a list on a phone, and a pill
          shows what is on without being opened. */}
      <FilterPillRow label={t("filterCategory")}>
        <FilterPill
          active={category === ""}
          onClick={() => void setCategory(null)}
        >
          {t("allTopics")}
        </FilterPill>
        {categories.map((option) => {
          const Icon = categoryIcon(option.icon);
          const active = category === option.id;
          return (
            <FilterPill
              key={option.id}
              active={active}
              onClick={() => void setCategory(active ? null : option.id)}
            >
              <Icon
                className="size-[18px]"
                style={active ? undefined : { color: option.color }}
                aria-hidden
              />
              {option.name}
            </FilterPill>
          );
        })}
      </FilterPillRow>

      {query.isPending ? (
        <ListRowSkeleton label={t("loading")} />
      ) : query.isError ? (
        <EmptyState
          illustration="cases"
          title={t("loadError")}
          action={
            <Button
              className="rounded-full px-6"
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          illustration="cases"
          title={
            mine ? t("emptyMine") : category ? t("emptyTopic") : t("empty")
          }
          action={
            category ? (
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => void setCategory(null)}
              >
                {t("allTopics")}
              </Button>
            ) : (
              <Button
                className="rounded-full px-6"
                onClick={() => setOpening(true)}
              >
                <Plus className="size-4" aria-hidden />
                {t("open")}
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`grupo-${group.key}`}>
              <h2
                id={`grupo-${group.key}`}
                className="border-border border-b pb-2 font-semibold text-muted-foreground text-sm"
              >
                {groupT(group.key)}
              </h2>
              <ul className="ruled">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <ListRow
                      href={`/consultas/${item.slug}`}
                      headingLevel={3}
                      leading={
                        <RowPictogram
                          icon={categoryIcon(item.categoryIcon)}
                          color={item.categoryColor}
                        />
                      }
                      title={item.title}
                      meta={`${item.municipalityName} · ${format.relativeTime(new Date(item.createdAt), now)}`}
                      badge={
                        <span className="flex items-center gap-3">
                          <StatusBadge status={item.status} />
                          {item.supportCount > 0 && (
                            <span
                              className="flex items-center gap-1 text-muted-foreground text-sm tabular-nums"
                              title={t("support.count", {
                                count: item.supportCount,
                              })}
                            >
                              <Users className="size-4" aria-hidden />
                              <span className="sr-only">
                                {t("support.count", {
                                  count: item.supportCount,
                                })}
                              </span>
                              <span aria-hidden>
                                {t("support.short", {
                                  count: item.supportCount,
                                })}
                              </span>
                            </span>
                          )}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <OpenConsultationDrawer
        municipalityName={home?.name ?? null}
        open={opening}
        onOpenChange={setOpening}
      />
    </div>
  );
}

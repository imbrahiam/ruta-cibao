"use client";

import { useQuery } from "@tanstack/react-query";
import { MessagesSquare, Plus, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { OpenConsultationDrawer } from "@/components/consultations/open-consultation-drawer";
import { StatusBadge } from "@/components/consultations/status-badge";
import { ListSkeleton } from "@/components/shell/list-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * Every case the province has open, and the ones you opened.
 *
 * Public, and that is the point of the screen rather than a permission
 * oversight. A resident about to report the same broken pipe as four neighbours
 * should see those four first, and an ayuntamiento answering in public answers
 * to more than the one person who wrote in.
 *
 * The filters live in the URL, like the map's, so a link to "las consultas de
 * agua sin responder" is a link somebody can send.
 */
export function ConsultationList() {
  const t = useTranslations("consultations");
  const format = useFormatter();
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

  const query = useQuery(
    orpc.consultations.browse.queryOptions({
      input: { mine: scope === "mios", category, limit: 24 },
    }),
  );

  const items = query.data?.items ?? [];
  const mine = scope === "mios";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="page-title">{t("title")}</h1>
            <p className="page-lede">{t("intro")}</p>
          </div>

          <Button
            className="h-11 rounded-full px-5 shadow-sm"
            onClick={() => setOpening(true)}
          >
            <Plus className="size-4" aria-hidden />
            {t("open")}
          </Button>
        </div>
      </header>

      {viewer && viewer.kind !== "anonymous" && (
        <Tabs value={scope} onValueChange={(value) => void setScope(value)}>
          <TabsList className="w-full rounded-full p-1 sm:w-auto">
            <TabsTrigger value="todos" className="h-9 rounded-full">
              {t("all")}
            </TabsTrigger>
            <TabsTrigger value="mios" className="h-9 rounded-full">
              {t("mine")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* The taxonomy as chips rather than a select: there are four of them,
          they are the fastest way to narrow a list on a phone, and a chip shows
          what is on without being opened. */}
      <fieldset
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label={t("filterCategory")}
      >
        <button
          type="button"
          aria-pressed={category === ""}
          onClick={() => void setCategory(null)}
          className={cn(
            "flex h-10 shrink-0 items-center rounded-full border px-4 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            category === ""
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-secondary",
          )}
        >
          {t("all")}
        </button>
        {categories.map((option) => {
          const Icon = categoryIcon(option.icon);
          const active = category === option.id;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => void setCategory(active ? null : option.id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary",
              )}
            >
              <Icon
                className="size-4"
                style={{ color: active ? undefined : option.color }}
                aria-hidden
              />
              {option.name}
            </button>
          );
        })}
      </fieldset>

      {query.isPending && <ListSkeleton label={t("loading")} />}

      {query.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t("loadError")}
        </p>
      )}

      {!query.isPending && items.length === 0 && (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquare />
            </EmptyMedia>
            <EmptyTitle>{mine ? t("emptyMine") : t("empty")}</EmptyTitle>
            <EmptyDescription>
              {mine ? t("emptyMineHint") : t("emptyHint")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const Icon = categoryIcon(item.categoryIcon);

          return (
            <li key={item.id}>
              <Link
                href={`/consultas/${item.slug}`}
                className="surface-card group block p-5 transition-[box-shadow,transform] duration-200 hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5"
              >
                <article className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `${item.categoryColor}1f`,
                        color: item.categoryColor,
                      }}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-pretty font-semibold leading-snug tracking-tight">
                        {item.title}
                      </h2>
                      <p className="text-muted-foreground text-xs">
                        {item.categoryName} · {item.municipalityName} ·{" "}
                        {format.relativeTime(new Date(item.createdAt))}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <Badge variant="secondary" className="tabular-nums">
                      <Users className="size-3.5" aria-hidden />
                      {item.supportCount}
                    </Badge>
                    {item.responseCount > 0 && (
                      <Badge variant="outline" className="tabular-nums">
                        <MessagesSquare className="size-3.5" aria-hidden />
                        {item.responseCount}
                      </Badge>
                    )}
                  </div>
                </article>
              </Link>
            </li>
          );
        })}
      </ul>

      <OpenConsultationDrawer
        municipalityName={home?.name ?? null}
        open={opening}
        onOpenChange={setOpening}
      />
    </div>
  );
}

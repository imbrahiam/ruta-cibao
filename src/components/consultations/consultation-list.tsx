"use client";

import { useQuery } from "@tanstack/react-query";
import { MessagesSquare, Plus, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { OpenConsultationDrawer } from "@/components/consultations/open-consultation-drawer";
import { StatusBadge } from "@/components/consultations/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
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
          <div className="space-y-1">
            <h1 className="font-semibold text-2xl tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("intro")}
            </p>
          </div>

          <Button className="h-11" onClick={() => setOpening(true)}>
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
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
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
              />
              {option.name}
            </button>
          );
        })}
      </fieldset>

      {query.isPending && (
        <p
          className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm"
          role="status"
        >
          <Spinner className="size-4" /> {t("loading")}
        </p>
      )}

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

      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const Icon = categoryIcon(item.categoryIcon);

          return (
            <li key={item.id}>
              <Link
                href={`/consultas/${item.slug}`}
                className="block rounded-2xl border bg-card p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-pretty font-medium leading-snug">
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

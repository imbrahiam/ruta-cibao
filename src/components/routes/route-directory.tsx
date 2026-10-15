"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { RouteCard } from "@/components/routes/route-card";
import { RouteForm } from "@/components/routes/route-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import {
  FilterPill,
  FilterPillRow,
} from "@/components/ui-patterns/filter-pill";
import { Segmented } from "@/components/ui-patterns/segmented";
import { useRealtime } from "@/hooks/use-realtime";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";
import { uuid } from "@/lib/uuid";
import { difficulty, type EcoRoute } from "@/modules/routes/contracts";

function ReviewRoute({ route }: { route: EcoRoute }) {
  const t = useTranslations("routes");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const decide = useMutation({
    ...orpc.routes.decide.mutationOptions(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orpc.routes.browse.key() }),
    onError: () => toast.error(t("failed")),
  });
  return (
    <div className="space-y-3 border-t pt-4">
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("reviewNote")}
        aria-label={t("reviewNote")}
        minLength={5}
        maxLength={1000}
      />
      <div className="flex gap-2">
        {(["published", "rejected"] as const).map((status) => (
          <Button
            key={status}
            variant={status === "published" ? "default" : "outline"}
            disabled={note.trim().length < 5 || decide.isPending}
            onClick={() =>
              decide.mutate({
                requestId: uuid(),
                id: route.id,
                status,
                note,
              })
            }
          >
            {t(status === "published" ? "approve" : "reject")}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function RouteDirectory() {
  const t = useTranslations("routes");
  const { viewer } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useQueryState(
    "ver",
    parseAsString.withDefault("publicadas"),
  );
  const [level, setLevel] = useQueryState(
    "dificultad",
    parseAsString.withDefault(""),
  );
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const isMember = viewer && viewer.kind !== "anonymous";
  const isStaff = viewer?.kind === "citizen" && viewer.staffRole !== "none";
  const parsedLevel = difficulty.safeParse(level);
  const query = useQuery(
    orpc.routes.browse.queryOptions({
      input: {
        scope:
          scope === "mias"
            ? "mine"
            : scope === "pendientes"
              ? "pending"
              : "published",
        difficulty: parsedLevel.success ? parsedLevel.data : undefined,
        offset,
      },
    }),
  );
  useRealtime({
    channels: ["routes"],
    onEvent: () =>
      queryClient.invalidateQueries({ queryKey: orpc.routes.browse.key() }),
  });
  const scopes = [
    { value: "publicadas", label: t("all") },
    ...(isMember ? [{ value: "mias", label: t("mine") }] : []),
    ...(isStaff ? [{ value: "pendientes", label: t("pendingShort") }] : []),
  ];
  const reviewing = isStaff && scope === "pendientes";

  const nothingYet =
    !parsedLevel.success && scope === "publicadas" && query.data?.total === 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h1 className="page-title max-w-2xl">{t("title")}</h1>
        {isMember ? (
          <Button
            className="h-11 rounded-full px-5"
            onClick={() => setCreating(!creating)}
          >
            <Plus aria-hidden />
            {t("create")}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            nativeButton={false}
            render={<Link href="/entrar?callbackUrl=%2Frutas" />}
          >
            {t("signIn")}
          </Button>
        )}
      </header>
      {creating && (
        <RouteForm
          onDone={() => {
            setCreating(false);
            void setScope("mias");
            setOffset(0);
          }}
        />
      )}
      {scopes.length > 1 && (
        <Segmented
          className="sm:max-w-md"
          label={t("scope")}
          value={scope}
          onChange={(value) => {
            void setScope(value || "publicadas");
            setOffset(0);
          }}
          options={scopes}
        />
      )}
      {/* With no routes at all, a row of filters is a set of controls over
          nothing — and the empty state below would blame them. */}
      {!nothingYet && (
        <FilterPillRow label={t("difficultyLabel")}>
          <FilterPill
            active={!parsedLevel.success}
            onClick={() => {
              void setLevel(null);
              setOffset(0);
            }}
          >
            {t("allDifficulties")}
          </FilterPill>
          {difficulty.options.map((value) => (
            <FilterPill
              key={value}
              active={parsedLevel.success && parsedLevel.data === value}
              onClick={() => {
                void setLevel(level === value ? null : value);
                setOffset(0);
              }}
            >
              {t(`difficulty.${value}`)}
            </FilterPill>
          ))}
        </FilterPillRow>
      )}

      {query.isPending ? (
        <div
          role="status"
          className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5"
        >
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
            <div key={index} aria-hidden>
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="mt-3 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3.5 w-1/2" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          illustration="routes"
          title={t("failed")}
          action={
            <Button
              className="rounded-full px-6"
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : query.data.total === 0 ? (
        <EmptyState
          illustration="routes"
          title={parsedLevel.success ? t("empty") : t("emptyNone")}
          action={
            parsedLevel.success ? (
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => void setLevel(null)}
              >
                {t("allDifficulties")}
              </Button>
            ) : isMember ? (
              <Button
                className="rounded-full px-6"
                onClick={() => setCreating(true)}
              >
                <Plus aria-hidden />
                {t("create")}
              </Button>
            ) : undefined
          }
        />
      ) : reviewing ? (
        // A reviewer needs the words, not just the picture: the description,
        // the services and the note box sit under each card.
        <ul className="grid gap-x-6 gap-y-10 md:grid-cols-2">
          {query.data.items.map((route) => (
            <li key={route.id} className="space-y-3">
              <RouteCard route={route} />
              <p className="text-[15px] leading-relaxed">{route.description}</p>
              <p className="text-muted-foreground text-sm">
                {route.services
                  .map((service) => t(`services.${service}`))
                  .join(" · ") || t("noServices")}
              </p>
              <ReviewRoute route={route} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
          {query.data.items.map((route) => (
            <li key={route.id}>
              <RouteCard route={route} />
              {route.reviewNote && (
                <p className="mt-2 border-border border-l-2 pl-3 text-muted-foreground text-sm leading-relaxed">
                  <span className="font-medium text-foreground">
                    {t("reviewNote")}:
                  </span>{" "}
                  {route.reviewNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {(query.data?.total ?? 0) > 24 && (
        <nav
          aria-label={t("pagination")}
          className="flex justify-center gap-4 pt-4"
        >
          <Button
            variant="outline"
            className="rounded-full px-5"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 24))}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            className="rounded-full px-5"
            disabled={offset + 24 >= (query.data?.total ?? 0)}
            onClick={() => setOffset(offset + 24)}
          >
            {t("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}

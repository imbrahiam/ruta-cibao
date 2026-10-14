"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Clock, Mountain, Plus, Route } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { RouteForm } from "@/components/routes/route-form";
import { ListSkeleton } from "@/components/shell/list-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
  const format = useFormatter();
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
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="page-eyebrow">{t("eyebrow")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-lede">{t("intro")}</p>
        </div>
        {isMember ? (
          <Button
            className="h-11 rounded-full px-5 shadow-sm"
            onClick={() => setCreating(!creating)}
          >
            <Plus aria-hidden />
            {t("create")}
          </Button>
        ) : (
          <Button
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
      <div className="flex flex-wrap gap-3">
        <NativeSelect
          size="lg"
          value={scope}
          aria-label={t("scope")}
          onChange={(event) => {
            void setScope(event.target.value);
            setOffset(0);
          }}
        >
          <option value="publicadas">{t("all")}</option>
          {isMember && <option value="mias">{t("mine")}</option>}
          {isStaff && <option value="pendientes">{t("pending")}</option>}
        </NativeSelect>
        <NativeSelect
          size="lg"
          value={level}
          aria-label={t("difficultyLabel")}
          onChange={(event) => {
            void setLevel(event.target.value);
            setOffset(0);
          }}
        >
          <option value="">{t("allDifficulties")}</option>
          {difficulty.options.map((value) => (
            <option key={value} value={value}>
              {t(`difficulty.${value}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {query.isPending && <ListSkeleton label={t("loading")} rows={2} />}
      {query.isError && (
        <div role="alert" className="surface-card p-6">
          <p>{t("failed")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}
      {query.data?.total === 0 && (
        <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
          <Mountain
            className="mx-auto mb-4 size-9 text-muted-foreground"
            aria-hidden
          />
          <h2 className="font-semibold text-xl tracking-tight">{t("empty")}</h2>
          <p className="mt-2 max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed">
            {t("emptyHint")}
          </p>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {query.data?.items.map((route) => (
          <article
            key={route.id}
            className="surface-card flex flex-col gap-4 p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{route.categoryName}</Badge>
              <span className="text-xs text-muted-foreground">
                {route.municipalityName}
              </span>
              {route.status !== "published" && (
                <Badge variant="outline">{t(`status.${route.status}`)}</Badge>
              )}
            </div>
            <h2 className="text-pretty font-semibold text-xl tracking-tight">
              {route.name}
            </h2>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {route.description}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Route className="size-4" aria-hidden />
                {format.number(route.distanceMeters / 1000, {
                  maximumFractionDigits: 1,
                })}{" "}
                {t("km")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                {t("minutes", { count: route.durationMinutes })}
              </span>
              <span>{t(`difficulty.${route.difficulty}`)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {route.services
                .map((service) => t(`services.${service}`))
                .join(" · ") || t("noServices")}
            </p>
            {route.reviewNote && (
              <p className="rounded-lg bg-muted p-3 text-sm">
                {route.reviewNote}
              </p>
            )}
            <Button
              nativeButton={false}
              render={<Link href={`/mapa?ruta=${route.id}`} />}
              variant="outline"
              className="mt-auto h-11 self-start"
            >
              {t("openMap")}
              <ArrowUpRight aria-hidden />
            </Button>
            {isStaff && scope === "pendientes" && <ReviewRoute route={route} />}
          </article>
        ))}
      </div>
      {(query.data?.total ?? 0) > 24 && (
        <nav aria-label={t("pagination")} className="flex justify-between">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 24))}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
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

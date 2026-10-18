"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Footprints,
  MapPinned,
  Mountain,
  Plus,
  Undo2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Chip, Tag } from "@/components/ui/tag";
import { toast } from "@/components/ui/toast";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { useRouter } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { errorReason } from "@/lib/errors";
import { isSubmittable } from "@/lib/map/config";
import { newIdempotencyKey } from "@/lib/offline/submit";
import { orpc } from "@/lib/orpc";
import { RouteMap } from "./route-map";
import { RouteShape } from "./route-shape";

type Scope = "published" | "mine" | "pending";
const DIFFICULTIES = ["easy", "moderate", "hard"] as const;
const SERVICES = [
  "water",
  "food",
  "lodging",
  "guide",
  "parking",
  "restrooms",
] as const;

function useDistance() {
  const format = useFormatter();
  return (meters: number) =>
    meters >= 1000
      ? format.number(meters / 1000, "distance")
      : `${Math.round(meters)} m`;
}

function useDuration() {
  const t = useTranslations("routes");
  return (minutes: number) =>
    minutes >= 60
      ? t("hours", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
      : t("minutes", { minutes });
}

export function RouteDirectory() {
  const t = useTranslations("routes");
  const { isSignedIn, isStaff } = useAuth();
  const signInHref = useSignInHref();
  const router = useRouter();
  const [scope, setScope] = useQueryState(
    "ver",
    parseAsString.withDefault("published"),
  );
  const [difficulty, setDifficulty] = useQueryState(
    "dificultad",
    parseAsString.withDefault(""),
  );
  const [openId, setOpenId] = useQueryState(
    "ruta",
    parseAsString.withOptions({ history: "push" }),
  );
  const [proposing, setProposing] = useQueryState(
    "proponer",
    parseAsString.withOptions({ history: "push" }),
  );
  const activeScope = (
    ["published", "mine", "pending"].includes(scope) ? scope : "published"
  ) as Scope;
  const distance = useDistance();
  const duration = useDuration();

  const routes = useQuery(
    orpc.routes.browse.queryOptions({
      input: {
        scope: activeScope,
        difficulty: (difficulty || undefined) as
          | (typeof DIFFICULTIES)[number]
          | undefined,
        limit: 48,
      },
    }),
  );

  useEffect(() => {
    if (proposing && !isSignedIn) router.replace(signInHref as "/entrar");
  }, [proposing, isSignedIn, router, signInHref]);

  const items = routes.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isSignedIn ? (
          <Segmented
            label={t("scopeLabel")}
            value={activeScope}
            onChange={(value) =>
              void setScope(value === "published" ? null : value)
            }
            options={[
              { value: "published", label: t("scopes.published") },
              { value: "mine", label: t("scopes.mine") },
              ...(isStaff
                ? [{ value: "pending" as const, label: t("scopes.pending") }]
                : []),
            ]}
          />
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          <Chip selected={!difficulty} onClick={() => void setDifficulty(null)}>
            {t("allDifficulties")}
          </Chip>
          {DIFFICULTIES.map((value) => (
            <Chip
              key={value}
              selected={difficulty === value}
              onClick={() =>
                void setDifficulty(difficulty === value ? null : value)
              }
            >
              {t(`difficulty.${value}`)}
            </Chip>
          ))}
        </div>
      </div>

      {routes.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Placeholder key={key} className="h-80" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title={
            activeScope === "pending"
              ? t("emptyPending")
              : activeScope === "mine"
                ? t("emptyMine")
                : t("empty")
          }
          body={activeScope === "pending" ? undefined : t("emptyHint")}
          action={
            activeScope === "pending" ? null : (
              <Button variant="primary" onClick={() => void setProposing("1")}>
                <Plus strokeWidth={1.75} />
                {t("propose")}
              </Button>
            )
          }
        />
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((route) => (
            <li key={route.id} className="flex">
              <button
                type="button"
                onClick={() => void setOpenId(route.id)}
                className="group flex w-full flex-col overflow-hidden rounded-card bg-card text-left shadow-ring transition-shadow hover:shadow-md"
              >
                <RouteShape
                  path={route.path}
                  color="var(--accent)"
                  className="aspect-[3/2] w-full"
                />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>{t(`difficulty.${route.difficulty}`)}</Tag>
                    {route.status !== "published" ? (
                      <Tag
                        tone={route.status === "pending" ? "warning" : "danger"}
                      >
                        {t(`status.${route.status}`)}
                      </Tag>
                    ) : null}
                  </div>
                  <p className="mt-2.5 text-[17px] leading-snug font-medium tracking-[-0.012em] text-ink">
                    {route.name}
                  </p>
                  <p className="t-small mt-1 text-ink-3">
                    {route.categoryName} · {route.municipalityName}
                  </p>
                  <p className="t-small mt-3 flex items-center gap-4 text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinned
                        strokeWidth={1.5}
                        className="size-4 text-ink-3"
                      />
                      {distance(route.distanceMeters)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock strokeWidth={1.5} className="size-4 text-ink-3" />
                      {duration(route.durationMinutes)}
                    </span>
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <RouteSheet id={openId} onClose={() => void setOpenId(null)} />
      {isSignedIn ? (
        <ProposeSheet
          open={Boolean(proposing)}
          onClose={() => void setProposing(null)}
        />
      ) : null}
    </div>
  );
}

function RouteSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("routes");
  const { isStaff } = useAuth();
  const distance = useDistance();
  const duration = useDuration();
  const route = useQuery({
    ...orpc.routes.detail.queryOptions({ input: { id: id ?? "" } }),
    enabled: Boolean(id),
  });
  const data = route.data;

  return (
    <Sheet
      open={Boolean(id)}
      onOpenChange={(open) => !open && onClose()}
      title={data?.name ?? t("loadingRoute")}
      description={
        data ? `${data.categoryName} · ${data.municipalityName}` : undefined
      }
      size="lg"
    >
      {!data ? (
        <Placeholder className="h-64" />
      ) : (
        <div className="flex flex-col gap-5">
          <div
            data-base-ui-swipe-ignore
            className="overflow-hidden rounded-card shadow-ring"
          >
            <RouteMap
              path={data.path}
              label={t("mapLabel", { name: data.name })}
              className="relative h-64"
            />
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {[
              [t("distance"), distance(data.distanceMeters)],
              [t("duration"), duration(data.durationMinutes)],
              [t("difficultyLabel"), t(`difficulty.${data.difficulty}`)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-card bg-paper-2 px-3 py-3">
                <dt className="t-label text-ink-3">{label}</dt>
                <dd className="mt-1 text-[15px] text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="t-body whitespace-pre-line text-ink-2">
            {data.description}
          </p>
          {data.services.length ? (
            <div>
              <h3 className="t-label mb-2 text-ink-3">{t("servicesLabel")}</h3>
              <div className="flex flex-wrap gap-2">
                {data.services.map((service) => (
                  <Tag key={service}>{t(`services.${service}`)}</Tag>
                ))}
              </div>
            </div>
          ) : null}
          {data.reviewNote && data.status !== "published" ? (
            <p className="t-small rounded-card bg-paper-2 px-4 py-3 text-ink-2">
              {t("reviewNote")}: {data.reviewNote}
            </p>
          ) : null}
          {data.path[0] ? (
            <ButtonLink
              href={`/mapa`}
              variant="secondary"
              className="self-start"
            >
              <Mountain strokeWidth={1.5} />
              {t("openMap")}
            </ButtonLink>
          ) : null}
          {isStaff && data.status === "pending" ? (
            <DecideRoute id={data.id} onDone={onClose} />
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

function DecideRoute({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations("routes.decide");
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const decide = useMutation(
    orpc.routes.decide.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.routes.key() });
        toast.success({
          title: result.status === "published" ? t("published") : t("rejected"),
        });
        onDone();
      },
      onError: () => toast.error({ title: t("failed") }),
    }),
  );
  return (
    <div className="rounded-card bg-paper-2 p-4">
      <Field htmlFor="route-note" label={t("note")} hint={t("noteHint")}>
        <Textarea
          id="route-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-20"
        />
      </Field>
      <div className="mt-3 flex gap-2">
        {(["published", "rejected"] as const).map((status) => (
          <Button
            key={status}
            variant={status === "published" ? "primary" : "danger"}
            disabled={note.trim().length < 5 || decide.isPending}
            onClick={() =>
              decide.mutate({
                requestId: newIdempotencyKey(),
                id,
                status,
                note: note.trim(),
              })
            }
          >
            {t(status)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ProposeSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("routes.form");
  const tRoutes = useTranslations("routes");
  const queryClient = useQueryClient();
  const categories = useQuery({
    ...orpc.routes.categories.queryOptions(),
    enabled: open,
  });
  const [path, setPath] = useState<{ lng: number; lat: number }[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    duration: "60",
    difficulty: "easy" as (typeof DIFFICULTIES)[number],
  });
  const [services, setServices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const add = useCallback((point: { lng: number; lat: number }) => {
    if (isSubmittable(point)) setPath((current) => [...current, point]);
  }, []);

  const submit = useMutation(
    orpc.routes.submit.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.routes.key() });
        toast.success({ title: t("sent"), description: t("sentHint") });
        setPath([]);
        onClose();
      },
      onError: (caught) =>
        setError(
          t(`errors.${errorReason(caught) ?? "unknown"}` as "errors.unknown"),
        ),
    }),
  );

  const valid =
    form.name.trim().length >= 5 &&
    form.description.trim().length >= 40 &&
    Boolean(form.categoryId) &&
    path.length >= 2 &&
    Number(form.duration) >= 5;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      description={t("description")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="accent"
            disabled={!valid || submit.isPending}
            onClick={() =>
              submit.mutate({
                requestId: newIdempotencyKey(),
                name: form.name.trim(),
                description: form.description.trim(),
                categoryId: form.categoryId,
                path,
                durationMinutes: Number(form.duration),
                difficulty: form.difficulty,
                services: services as (typeof SERVICES)[number][],
              })
            }
          >
            {submit.isPending ? t("sending") : t("submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[14px] font-medium text-ink">{t("pathLabel")}</p>
          <p className="t-small text-ink-3">{t("pathHint")}</p>
          <div
            data-base-ui-swipe-ignore
            className="relative mt-2 overflow-hidden rounded-card shadow-ring"
          >
            {open ? (
              <RouteMap
                path={path}
                onAdd={add}
                label={t("pathLabel")}
                className="relative h-72"
              />
            ) : null}
            <div className="absolute right-2 bottom-2 z-10 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!path.length}
                onClick={() => setPath((current) => current.slice(0, -1))}
              >
                <Undo2 strokeWidth={1.5} />
                {t("undo")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!path.length}
                onClick={() => setPath([])}
              >
                {t("clear")}
              </Button>
            </div>
            <span
              className={cx(
                "t-label absolute top-2 left-2 z-10 rounded-full px-2.5 py-1 glass",
                path.length >= 2 ? "text-accent" : "text-ink-2",
              )}
            >
              {t("points", { count: path.length })}
            </span>
          </div>
        </div>
        <Field htmlFor="route-name" label={t("name")}>
          <Input
            id="route-name"
            value={form.name}
            maxLength={120}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="route-category" label={t("category")}>
            <Select
              id="route-category"
              value={form.categoryId}
              onChange={(event) =>
                setForm({ ...form, categoryId: event.target.value })
              }
            >
              <option value="" disabled>
                {t("categoryPlaceholder")}
              </option>
              {(categories.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            htmlFor="route-duration"
            label={t("duration")}
            hint={t("durationHint")}
          >
            <Input
              id="route-duration"
              type="number"
              inputMode="numeric"
              min={5}
              max={10080}
              value={form.duration}
              onChange={(event) =>
                setForm({ ...form, duration: event.target.value })
              }
            />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium text-ink">
            {tRoutes("difficultyLabel")}
          </p>
          <Segmented
            label={tRoutes("difficultyLabel")}
            value={form.difficulty}
            onChange={(value) => setForm({ ...form, difficulty: value })}
            options={DIFFICULTIES.map((value) => ({
              value,
              label: tRoutes(`difficulty.${value}`),
            }))}
          />
        </div>
        <div>
          <p className="mb-2 text-[14px] font-medium text-ink">
            {tRoutes("servicesLabel")}
          </p>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((service) => (
              <Chip
                key={service}
                selected={services.includes(service)}
                onClick={() =>
                  setServices((current) =>
                    current.includes(service)
                      ? current.filter((item) => item !== service)
                      : [...current, service],
                  )
                }
              >
                {tRoutes(`services.${service}`)}
              </Chip>
            ))}
          </div>
        </div>
        <Field
          htmlFor="route-description"
          label={t("descriptionLabel")}
          hint={t("descriptionHint", {
            count: Math.max(0, 40 - form.description.trim().length),
          })}
        >
          <Textarea
            id="route-description"
            value={form.description}
            maxLength={3000}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        {error ? (
          <p role="alert" className="t-small text-danger-ink">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Flag,
  Footprints,
  ImageIcon,
  type LucideIcon,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Store,
  Tags,
  TrafficCone,
  X,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { CategoryIcon } from "@/components/places/category-icon";
import { RemoveSheet } from "@/components/traffic/traffic-detail";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { Sheet } from "@/components/ui/sheet";
import { Tag } from "@/components/ui/tag";
import { toast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { newIdempotencyKey } from "@/lib/offline/submit";
import { orpc } from "@/lib/orpc";

const QUEUES = [
  "places",
  "reports",
  "photos",
  "claims",
  "consultations",
  "traffic",
  "routes",
] as const;
type Queue = (typeof QUEUES)[number];

const ICONS: Record<Queue, LucideIcon> = {
  places: MapPin,
  reports: Flag,
  photos: ImageIcon,
  claims: Store,
  consultations: MessagesSquare,
  traffic: TrafficCone,
  routes: Footprints,
};

/**
 * The municipality's desk. One queue at a time, oldest first, each item with
 * the evidence needed to decide and the two buttons that decide it. Refusing
 * always asks for a note, because the person who sent it gets that note.
 */
export function ModerationDesk() {
  const t = useTranslations("moderation");
  const { viewer, isStaff, isLoading } = useAuth();
  const [queue, setQueue] = useQueryState(
    "cola",
    parseAsStringLiteral(QUEUES).withDefault("places"),
  );
  const counts = useQuery({
    ...orpc.moderation.counts.queryOptions(),
    enabled: isStaff,
  });
  const identity = useQuery({
    ...orpc.identity.pendingCount.queryOptions(),
    enabled: isStaff,
  });
  const routes = useQuery({
    ...orpc.routes.browse.queryOptions({
      input: { scope: "pending", limit: 50 },
    }),
    enabled: isStaff,
  });

  if (isLoading) return <Placeholder className="h-96" />;
  if (!isStaff) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("forbidden")}
        body={t("forbiddenHint")}
      />
    );
  }

  const count = (name: Queue) =>
    name === "routes" ? (routes.data?.total ?? 0) : (counts.data?.[name] ?? 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <nav
        aria-label={t("queues")}
        className="min-w-0 lg:sticky lg:top-24 lg:self-start"
      >
        <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
          {QUEUES.map((name) => {
            const Icon = ICONS[name];
            const active = queue === name;
            return (
              <li key={name}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => void setQueue(name)}
                  className={cx(
                    "press flex h-10 w-full items-center gap-2.5 rounded-full px-3.5 text-[15px] whitespace-nowrap lg:h-11 lg:rounded-[12px]",
                    active
                      ? "bg-accent text-on-accent shadow-sm"
                      : "bg-card text-ink-2 shadow-ring hover:text-ink lg:bg-transparent lg:shadow-none lg:hover:bg-paper-3",
                  )}
                >
                  <Icon strokeWidth={1.5} className="size-[18px] shrink-0" />
                  <span className="flex-1 text-left">{t(`tabs.${name}`)}</span>
                  {count(name) > 0 ? (
                    <span
                      className={cx(
                        "font-mono text-[12px] tabular",
                        active ? "text-paper/70" : "text-ink-3",
                      )}
                    >
                      {count(name)}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 hidden flex-col gap-1 border-t border-line/70 pt-4 lg:flex">
          <Link
            href="/moderacion/identidad"
            className="flex h-11 items-center gap-2.5 rounded-[12px] px-3.5 text-[15px] text-ink-2 hover:bg-paper-3 hover:text-ink"
          >
            <ShieldCheck strokeWidth={1.5} className="size-[18px]" />
            <span className="flex-1">{t("identity")}</span>
            {identity.data?.count ? (
              <span className="font-mono text-[12px] text-ink-3 tabular">
                {identity.data.count}
              </span>
            ) : null}
          </Link>
          {viewer?.staffRole === "admin" ? (
            <Link
              href="/moderacion/temas"
              className="flex h-11 items-center gap-2.5 rounded-[12px] px-3.5 text-[15px] text-ink-2 hover:bg-paper-3 hover:text-ink"
            >
              <Tags strokeWidth={1.5} className="size-[18px]" />
              {t("categories")}
            </Link>
          ) : null}
        </div>
      </nav>
      <section key={queue} className="min-w-0 animate-panel">
        {queue === "routes" ? <RoutesQueue /> : <QueueList queue={queue} />}
      </section>
    </div>
  );
}

function QueueList({ queue }: { queue: Exclude<Queue, "routes"> }) {
  const t = useTranslations("moderation");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const queryClient = useQueryClient();
  const list = useQuery(
    orpc.moderation.queue.queryOptions({ input: { queue, limit: 30 } }),
  );
  const [rejecting, setRejecting] = useState<{
    kind: "place" | "claim" | "report";
    id: string;
  } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.moderation.key() });
  };
  const onError = () => toast.error({ title: t("failed") });
  const place = useMutation(
    orpc.moderation.decidePlace.mutationOptions({
      onSuccess: refresh,
      onError,
    }),
  );
  const report = useMutation(
    orpc.moderation.decideReport.mutationOptions({
      onSuccess: refresh,
      onError,
    }),
  );
  const photo = useMutation(
    orpc.moderation.decidePhoto.mutationOptions({
      onSuccess: refresh,
      onError,
    }),
  );
  const claim = useMutation(
    orpc.moderation.decideClaim.mutationOptions({
      onSuccess: refresh,
      onError,
    }),
  );

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((key) => (
          <Placeholder key={key} className="h-36" />
        ))}
      </div>
    );
  }
  const data = list.data;
  const items = data ? data[queue] : [];
  if (!items.length)
    return (
      <EmptyState
        icon={Check}
        title={t("emptyTitle")}
        body={t(`empty.${queue}`)}
      />
    );

  const ago = (iso: string) => format.relativeTime(new Date(iso), now);

  return (
    <>
      <ul className="flex flex-col gap-3">
        {queue === "places" &&
          data?.places.map((item) => (
            <Card
              key={item.id}
              icon={
                <CategoryIcon
                  icon={item.categoryIcon}
                  className="size-5"
                  style={{ color: item.categoryColor }}
                />
              }
              eyebrow={`${item.categoryName} · ${item.municipalityName}`}
              title={item.name}
              meta={t("sentBy", {
                name: item.submittedBy ?? t("someone"),
                when: ago(item.createdAt),
              })}
              tags={
                <>
                  {item.submitterTier === "citizen" ? (
                    <Tag tone="accent">{t("citizen")}</Tag>
                  ) : (
                    <Tag>{t("visitor")}</Tag>
                  )}
                  {item.locationSource === "gps" ? (
                    <Tag tone="success">{t("gps")}</Tag>
                  ) : null}
                </>
              }
              body={item.description}
              extra={
                <a
                  className="t-small text-accent hover:underline"
                  href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=18/${item.lat}/${item.lng}`}
                  target="_blank"
                  rel="noopener"
                >
                  {t("seeLocation")}
                </a>
              }
              actions={
                <Decide
                  busy={place.isPending}
                  approveLabel={t("publish")}
                  onApprove={() =>
                    place.mutate({
                      requestId: newIdempotencyKey(),
                      placeId: item.id,
                      decision: "publish",
                    })
                  }
                  onReject={() => setRejecting({ kind: "place", id: item.id })}
                />
              }
            />
          ))}
        {queue === "reports" &&
          data?.reports.map((item) => (
            <Card
              key={item.id}
              icon={<Flag strokeWidth={1.5} className="size-5 text-ink-2" />}
              eyebrow={item.municipalityName}
              title={item.placeName}
              meta={t("sentBy", {
                name: item.reportedBy ?? t("someone"),
                when: ago(item.createdAt),
              })}
              tags={<Tag tone="warning">{t(`reasons.${item.reason}`)}</Tag>}
              body={item.details}
              extra={
                <Link
                  href={`/mapa?lugar=${item.placeSlug}`}
                  className="t-small text-accent hover:underline"
                >
                  {t("openPlace")}
                </Link>
              }
              actions={
                <Decide
                  busy={report.isPending}
                  approveLabel={t("resolve")}
                  rejectLabel={t("dismiss")}
                  onApprove={() =>
                    report.mutate({
                      requestId: newIdempotencyKey(),
                      reportId: item.id,
                      decision: "resolved",
                    })
                  }
                  onReject={() =>
                    report.mutate({
                      requestId: newIdempotencyKey(),
                      reportId: item.id,
                      decision: "dismissed",
                    })
                  }
                />
              }
            />
          ))}
        {queue === "photos" &&
          data?.photos.map((item) => (
            <Card
              key={item.id}
              media={
                // biome-ignore lint/performance/noImgElement: a presigned private URL
                <img
                  src={item.url}
                  alt={t("photoAlt", { name: item.placeName })}
                  className="h-48 w-full rounded-[12px] object-cover"
                />
              }
              eyebrow={item.municipalityName}
              title={item.placeName}
              meta={t("sentBy", {
                name: item.uploadedBy ?? t("someone"),
                when: ago(item.createdAt),
              })}
              actions={
                <Decide
                  busy={photo.isPending}
                  approveLabel={t("publish")}
                  onApprove={() =>
                    photo.mutate({
                      requestId: newIdempotencyKey(),
                      photoId: item.id,
                      decision: "publish",
                    })
                  }
                  onReject={() =>
                    photo.mutate({
                      requestId: newIdempotencyKey(),
                      photoId: item.id,
                      decision: "reject",
                    })
                  }
                />
              }
            />
          ))}
        {queue === "claims" &&
          data?.claims.map((item) => (
            <Card
              key={item.id}
              icon={<Store strokeWidth={1.5} className="size-5 text-ink-2" />}
              eyebrow={`${item.categoryName} · ${item.municipalityName}`}
              title={item.placeName}
              meta={t("claimedBy", { name: item.claimedBy ?? t("someone") })}
              tags={
                item.claimantTier === "citizen" ? (
                  <Tag tone="accent">{t("citizen")}</Tag>
                ) : null
              }
              body={item.evidence}
              extra={
                <dl className="t-small grid gap-1 text-ink-2 sm:grid-cols-3">
                  {item.contactPhone ? (
                    <div>
                      {t("phone")}: {item.contactPhone}
                    </div>
                  ) : null}
                  {item.whatsapp ? <div>WhatsApp: {item.whatsapp}</div> : null}
                  {item.openingHours ? <div>{item.openingHours}</div> : null}
                </dl>
              }
              actions={
                <Decide
                  busy={claim.isPending}
                  approveLabel={t("approve")}
                  onApprove={() =>
                    claim.mutate({
                      requestId: newIdempotencyKey(),
                      claimId: item.id,
                      decision: "approve",
                    })
                  }
                  onReject={() => setRejecting({ kind: "claim", id: item.id })}
                />
              }
            />
          ))}
        {queue === "consultations" &&
          data?.consultations.map((item) => (
            <Card
              key={item.id}
              icon={
                <CategoryIcon
                  icon={item.categoryIcon}
                  className="size-5"
                  style={{ color: item.categoryColor }}
                />
              }
              eyebrow={`${item.categoryName} · ${item.municipalityName}`}
              title={item.title}
              meta={t("openedBy", {
                name: item.openedBy ?? t("someone"),
                when: ago(item.createdAt),
                count: item.supportCount,
              })}
              body={item.body}
              actions={
                <ButtonLink
                  href={`/consultas/${item.slug}`}
                  variant="primary"
                  size="sm"
                >
                  {t("answer")}
                </ButtonLink>
              }
            />
          ))}
        {queue === "traffic" &&
          data?.traffic.map((item) => (
            <Card
              key={item.id}
              icon={
                <CategoryIcon
                  icon={item.categoryIcon}
                  className="size-5"
                  style={{ color: item.categoryColor }}
                />
              }
              eyebrow={item.municipalityName}
              title={item.categoryName}
              meta={t("sentBy", {
                name: item.reportedBy ?? t("someone"),
                when: ago(item.createdAt),
              })}
              body={item.description}
              extra={
                <Link
                  href={`/mapa?reporte=${item.id}`}
                  className="t-small text-accent hover:underline"
                >
                  {t("seeOnMap")}
                </Link>
              }
              actions={
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setRemoving(item.id)}
                >
                  {t("removeTraffic")}
                </Button>
              }
            />
          ))}
      </ul>
      <RejectSheet
        target={rejecting}
        onClose={() => setRejecting(null)}
        onReject={(note) => {
          if (!rejecting) return;
          const requestId = newIdempotencyKey();
          if (rejecting.kind === "place")
            place.mutate({
              requestId,
              placeId: rejecting.id,
              decision: "reject",
              note,
            });
          if (rejecting.kind === "claim")
            claim.mutate({
              requestId,
              claimId: rejecting.id,
              decision: "reject",
              note,
            });
          setRejecting(null);
        }}
      />
      {removing ? (
        <RemoveSheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setRemoving(null);
              refresh();
            }
          }}
          reportId={removing}
        />
      ) : null}
    </>
  );
}

function RoutesQueue() {
  const t = useTranslations("moderation");
  const routes = useQuery(
    orpc.routes.browse.queryOptions({ input: { scope: "pending", limit: 50 } }),
  );
  if (routes.isPending) return <Placeholder className="h-36" />;
  const items = routes.data?.items ?? [];
  if (!items.length)
    return (
      <EmptyState
        icon={Check}
        title={t("emptyTitle")}
        body={t("empty.routes")}
      />
    );
  return (
    <ul className="flex flex-col gap-3">
      {items.map((route) => (
        <Card
          key={route.id}
          icon={<Footprints strokeWidth={1.5} className="size-5 text-ink-2" />}
          eyebrow={`${route.categoryName} · ${route.municipalityName}`}
          title={route.name}
          body={route.description}
          actions={
            <ButtonLink
              href={`/rutas?ver=pending&ruta=${route.id}`}
              variant="primary"
              size="sm"
            >
              {t("review")}
            </ButtonLink>
          }
        />
      ))}
    </ul>
  );
}

function Card({
  icon,
  media,
  eyebrow,
  title,
  meta,
  tags,
  body,
  extra,
  actions,
}: {
  icon?: ReactNode;
  media?: ReactNode;
  eyebrow: string;
  title: string;
  meta?: string;
  tags?: ReactNode;
  body?: string | null;
  extra?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <li className="rounded-card bg-card p-4 shadow-ring md:p-5">
      {media ? <div className="mb-4">{media}</div> : null}
      <div className="flex gap-4">
        {icon ? (
          <span className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-paper-2 sm:flex">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="t-small text-ink-3">{eyebrow}</p>
          <p className="mt-0.5 text-[17px] leading-snug font-medium tracking-[-0.012em] text-ink">
            {title}
          </p>
          {meta ? <p className="t-small mt-1 text-ink-3">{meta}</p> : null}
          {tags ? (
            <div className="mt-2 flex flex-wrap gap-2">{tags}</div>
          ) : null}
          {body ? <p className="t-body mt-3 text-ink-2">{body}</p> : null}
          {extra ? <div className="mt-3">{extra}</div> : null}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-line/60 pt-4">
        {actions}
      </div>
    </li>
  );
}

function Decide({
  busy,
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
}: {
  busy: boolean;
  approveLabel: string;
  rejectLabel?: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("moderation");
  return (
    <>
      <Button size="sm" variant="secondary" disabled={busy} onClick={onReject}>
        <X strokeWidth={1.75} />
        {rejectLabel ?? t("reject")}
      </Button>
      <Button size="sm" variant="primary" disabled={busy} onClick={onApprove}>
        <Check strokeWidth={1.75} />
        {approveLabel}
      </Button>
    </>
  );
}

function RejectSheet({
  target,
  onClose,
  onReject,
}: {
  target: { kind: string; id: string } | null;
  onClose: () => void;
  onReject: (note: string) => void;
}) {
  const t = useTranslations("moderation.rejectForm");
  const [note, setNote] = useState("");
  return (
    <Sheet
      open={Boolean(target)}
      onOpenChange={(open) => !open && onClose()}
      title={t("title")}
      description={t("description")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={note.trim().length < 10}
            onClick={() => {
              onReject(note.trim());
              setNote("");
            }}
          >
            {t("submit")}
          </Button>
        </>
      }
    >
      <Field htmlFor="reject-note" label={t("note")} hint={t("noteHint")}>
        <Textarea
          id="reject-note"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </Sheet>
  );
}

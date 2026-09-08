"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  ExternalLink,
  LocateFixed,
  MapPin,
  MessagesSquare,
  Phone,
  ShieldCheck,
  Store,
  TrafficCone,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { newIdempotencyKey } from "@/lib/offline/queue";
import { client, orpc } from "@/lib/orpc";

/**
 * The queue.
 *
 * Oldest first and one card at a time, because moderation is a sequence of
 * small judgements and a dense table invites skimming. Each card carries
 * everything the decision needs — what was submitted, by whom, at which tier,
 * and whether they were standing there — so nobody has to open the map in
 * another tab to answer a question the card could have answered.
 *
 * Rejecting requires a reason. Somebody wrote a description of a place in their
 * own community; "no" without a sentence is how a civic platform loses the
 * contributors it depends on.
 */
type Queue =
  | "places"
  | "reports"
  | "photos"
  | "claims"
  | "consultations"
  | "traffic";

const QUEUES: Queue[] = [
  "places",
  "reports",
  "photos",
  "claims",
  "consultations",
  "traffic",
];

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
      {children}
    </span>
  );
}

export function ModerationQueue() {
  const t = useTranslations("moderation");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Queue>("places");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);

  const counts = useQuery(orpc.moderation.counts.queryOptions());
  const items = useQuery(
    orpc.moderation.queue.queryOptions({ input: { queue, limit: 20 } }),
  );

  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.moderation.queue.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.moderation.counts.queryOptions().queryKey,
      }),
    ]);
  }

  const decidePlace = useMutation({
    mutationFn: (input: {
      placeId: string;
      decision: "publish" | "reject";
      note?: string;
    }) =>
      client.moderation.decidePlace({
        requestId: newIdempotencyKey(),
        ...input,
      }),
    onSuccess: async (_result, input) => {
      toast.success(
        input.decision === "publish" ? t("published") : t("rejected"),
      );
      setRejecting(null);
      await refresh();
    },
    onError: () => toast.error(t("failed")),
  });

  const decidePhoto = useMutation({
    mutationFn: (input: { photoId: string; decision: "publish" | "reject" }) =>
      client.moderation.decidePhoto({
        requestId: newIdempotencyKey(),
        ...input,
      }),
    onSuccess: async (_result, input) => {
      toast.success(
        input.decision === "publish" ? t("published") : t("rejected"),
      );
      await refresh();
    },
    onError: () => toast.error(t("failed")),
  });

  const decideClaim = useMutation({
    mutationFn: (input: {
      claimId: string;
      decision: "approve" | "reject";
      note?: string;
    }) =>
      client.moderation.decideClaim({
        requestId: newIdempotencyKey(),
        ...input,
      }),
    onSuccess: async (_result, input) => {
      toast.success(
        input.decision === "approve" ? t("claimApproved") : t("claimRejected"),
      );
      setRejecting(null);
      await refresh();
    },
    onError: () => toast.error(t("failed")),
  });

  const removeTraffic = useMutation({
    mutationFn: (input: { reportId: string; note: string }) =>
      client.moderation.removeTraffic({
        requestId: newIdempotencyKey(),
        ...input,
      }),
    onSuccess: async () => {
      toast.success(t("trafficRemoved"));
      setRejecting(null);
      await refresh();
    },
    onError: () => toast.error(t("failed")),
  });

  const decideReport = useMutation({
    mutationFn: (input: {
      reportId: string;
      decision: "resolved" | "dismissed";
    }) =>
      client.moderation.decideReport({
        requestId: newIdempotencyKey(),
        ...input,
      }),
    onSuccess: async () => {
      toast.success(t("reportDecided"));
      await refresh();
    },
    onError: () => toast.error(t("failed")),
  });

  const pending =
    decidePlace.isPending ||
    decideReport.isPending ||
    decidePhoto.isPending ||
    decideClaim.isPending ||
    removeTraffic.isPending;
  const places = items.data?.places ?? [];
  const reports = items.data?.reports ?? [];
  const photos = items.data?.photos ?? [];
  const claims = items.data?.claims ?? [];
  const consultations = items.data?.consultations ?? [];
  const traffic = items.data?.traffic ?? [];
  const shown = { places, reports, photos, claims, consultations, traffic };
  const empty = !items.isPending && shown[queue].length === 0;

  // Each queue's empty state says what would put something in it, rather than
  // one sentence that is vague enough to cover six different things.
  const emptyCopy = {
    places: { title: t("empty"), hint: t("emptyHint") },
    reports: { title: t("empty"), hint: t("emptyHint") },
    photos: { title: t("empty"), hint: t("emptyHint") },
    claims: { title: t("emptyClaims"), hint: t("emptyClaimsHint") },
    consultations: {
      title: t("emptyConsultations"),
      hint: t("emptyConsultationsHint"),
    },
    traffic: { title: t("emptyTraffic"), hint: t("emptyTrafficHint") },
  }[queue];

  return (
    <div className="flex flex-col gap-6">
      {/* The real tabs primitive rather than buttons with `role="tablist"`:
          arrow-key roving, the active indicator and the panel wiring come with
          it, and a moderation desk is used with a keyboard. */}
      <Tabs
        value={queue}
        onValueChange={(value) => setQueue(value as Queue)}
        aria-label={t("title")}
      >
        {/* Six tabs do not fit a phone, so the list scrolls sideways rather than
            wrapping into two rows that push the cards down the screen. */}
        <TabsList className="w-full justify-start overflow-x-auto rounded-full p-1">
          {QUEUES.map((option) => (
            <TabsTrigger
              key={option}
              value={option}
              className="h-9 shrink-0 rounded-full data-active:bg-background data-active:shadow-sm"
            >
              {t(`queue.${option}`)}
              <Badge
                variant="secondary"
                className="px-1.5 text-xs tabular-nums"
              >
                {counts.data?.[option] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {items.isPending && (
          <p
            className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm"
            role="status"
          >
            <Spinner className="size-4" /> {t("loading")}
          </p>
        )}

        {empty && (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Check />
              </EmptyMedia>
              <EmptyTitle>{emptyCopy.title}</EmptyTitle>
              <EmptyDescription>{emptyCopy.hint}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <TabsContent value="places" className="flex flex-col gap-6">
          {places.map((place) => {
            const Icon = categoryIcon(place.categoryIcon);
            const isRejecting = rejecting === place.id;
            const note = notes[place.id] ?? "";

            return (
              <article
                key={place.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
              >
                <header className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${place.categoryColor}1a` }}
                  >
                    <Icon
                      className="size-5"
                      style={{ color: place.categoryColor }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-lg leading-tight">
                      {place.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Meta>
                        <MapPin className="size-3.5" aria-hidden />
                        {place.municipalityName}
                      </Meta>
                      <Meta>
                        <Clock className="size-3.5" aria-hidden />
                        {format.relativeTime(new Date(place.createdAt))}
                      </Meta>
                      {place.submittedBy && (
                        <Meta>
                          {place.submitterTier === "citizen" && (
                            <ShieldCheck
                              className="size-3.5 text-emerald-600"
                              aria-hidden
                            />
                          )}
                          {place.submittedBy}
                        </Meta>
                      )}
                    </div>
                  </div>
                </header>

                {place.description && (
                  <p className="text-pretty text-[15px] leading-relaxed">
                    {place.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{place.categoryName}</Badge>
                  {/* A point taken with GPS by a verified resident is a stronger
                    claim than one dragged across a map, and the moderator is
                    the one who should weigh that. */}
                  {place.locationSource === "gps" && (
                    <Badge variant="secondary" className="gap-1.5">
                      <LocateFixed className="size-3.5" aria-hidden />
                      {t("fromGps")}
                    </Badge>
                  )}
                  {place.address && (
                    <span className="text-muted-foreground text-sm">
                      {place.address}
                    </span>
                  )}
                </div>

                <Link
                  href={`/mapa?lugar=${place.slug}`}
                  className="flex w-fit items-center gap-1.5 font-medium text-sm underline underline-offset-4"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  {t("openOnMap")}
                </Link>

                {isRejecting && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={`note-${place.id}`}
                      className="font-medium text-sm"
                    >
                      {t("noteLabel")}
                    </label>
                    <Textarea
                      id={`note-${place.id}`}
                      value={note}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [place.id]: event.target.value,
                        }))
                      }
                      placeholder={t("notePlaceholder")}
                      minLength={10}
                      maxLength={500}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t("noteHint")}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="h-11 flex-1"
                    disabled={pending}
                    onClick={() =>
                      decidePlace.mutate({
                        placeId: place.id,
                        decision: "publish",
                      })
                    }
                  >
                    <Check className="size-4" aria-hidden />
                    {t("publish")}
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11 flex-1"
                    disabled={
                      pending || (isRejecting && note.trim().length < 10)
                    }
                    onClick={() => {
                      if (!isRejecting) {
                        setRejecting(place.id);
                        return;
                      }
                      decidePlace.mutate({
                        placeId: place.id,
                        decision: "reject",
                        note: note.trim(),
                      });
                    }}
                  >
                    <X className="size-4" aria-hidden />
                    {isRejecting ? t("confirmReject") : t("reject")}
                  </Button>
                </div>
              </article>
            );
          })}
        </TabsContent>

        <TabsContent value="reports" className="flex flex-col gap-6">
          {reports.map((report) => (
            <article
              key={report.id}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
            >
              <header className="min-w-0">
                <h2 className="font-medium text-lg leading-tight">
                  {report.placeName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Meta>
                    <MapPin className="size-3.5" aria-hidden />
                    {report.municipalityName}
                  </Meta>
                  <Meta>
                    <Clock className="size-3.5" aria-hidden />
                    {format.relativeTime(new Date(report.createdAt))}
                  </Meta>
                  {report.reportedBy && <Meta>{report.reportedBy}</Meta>}
                </div>
              </header>

              <Badge variant="secondary" className="w-fit">
                {t(`reasons.${report.reason}`)}
              </Badge>

              {report.details && (
                <p className="text-pretty text-[15px] leading-relaxed">
                  {report.details}
                </p>
              )}

              <Link
                href={`/mapa?lugar=${report.placeSlug}`}
                className="flex w-fit items-center gap-1.5 font-medium text-sm underline underline-offset-4"
              >
                <ExternalLink className="size-4" aria-hidden />
                {t("openOnMap")}
              </Link>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-11 flex-1"
                  disabled={pending}
                  onClick={() =>
                    decideReport.mutate({
                      reportId: report.id,
                      decision: "resolved",
                    })
                  }
                >
                  <Check className="size-4" aria-hidden />
                  {t("resolve")}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={pending}
                  onClick={() =>
                    decideReport.mutate({
                      reportId: report.id,
                      decision: "dismissed",
                    })
                  }
                >
                  <X className="size-4" aria-hidden />
                  {t("dismiss")}
                </Button>
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="photos" className="flex flex-col gap-6">
          {photos.map((photo) => (
            <article
              key={photo.id}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
            >
              {/* The photo, at a size a decision can actually be made from. It is
                unpublished, so the URL is signed and short-lived. */}
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-muted">
                <Image
                  src={photo.url}
                  alt={t("photoAlt", { place: photo.placeName })}
                  fill
                  sizes="(max-width: 768px) 100vw, 40rem"
                  className="object-contain"
                  unoptimized
                />
              </div>

              <header className="min-w-0">
                <h2 className="font-medium text-lg leading-tight">
                  {photo.placeName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Meta>
                    <MapPin className="size-3.5" aria-hidden />
                    {photo.municipalityName}
                  </Meta>
                  <Meta>
                    <Clock className="size-3.5" aria-hidden />
                    {format.relativeTime(new Date(photo.createdAt))}
                  </Meta>
                  {photo.uploadedBy && <Meta>{photo.uploadedBy}</Meta>}
                </div>
              </header>

              <Link
                href={`/mapa?lugar=${photo.placeSlug}`}
                className="flex w-fit items-center gap-1.5 font-medium text-sm underline underline-offset-4"
              >
                <ExternalLink className="size-4" aria-hidden />
                {t("openOnMap")}
              </Link>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-11 flex-1"
                  disabled={pending}
                  onClick={() =>
                    decidePhoto.mutate({
                      photoId: photo.id,
                      decision: "publish",
                    })
                  }
                >
                  <Check className="size-4" aria-hidden />
                  {t("publish")}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={pending}
                  onClick={() =>
                    decidePhoto.mutate({
                      photoId: photo.id,
                      decision: "reject",
                    })
                  }
                >
                  <X className="size-4" aria-hidden />
                  {t("reject")}
                </Button>
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="claims" className="flex flex-col gap-6">
          {claims.map((claim) => {
            const isRejecting = rejecting === claim.id;
            const note = notes[claim.id] ?? "";

            return (
              <article
                key={claim.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
              >
                <header className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
                  >
                    <Store className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-lg leading-tight">
                      {claim.placeName}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Meta>
                        <MapPin className="size-3.5" aria-hidden />
                        {claim.municipalityName}
                      </Meta>
                      <Meta>
                        <Clock className="size-3.5" aria-hidden />
                        {format.relativeTime(new Date(claim.createdAt))}
                      </Meta>
                      {claim.claimedBy && (
                        <Meta>
                          {claim.claimantTier === "citizen" && (
                            <ShieldCheck
                              className="size-3.5 text-emerald-600"
                              aria-hidden
                            />
                          )}
                          {claim.claimedBy}
                        </Meta>
                      )}
                    </div>
                  </div>
                </header>

                <Badge variant="secondary" className="w-fit">
                  {claim.categoryName}
                </Badge>

                <div className="space-y-1.5">
                  <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {t("claimEvidence")}
                  </h3>
                  <p className="text-pretty text-[15px] leading-relaxed">
                    {claim.evidence}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {t("claimContact")}
                  </h3>
                  {claim.contactPhone ||
                  claim.whatsapp ||
                  claim.openingHours ? (
                    <ul className="flex flex-col gap-1 text-sm">
                      {claim.contactPhone && (
                        <li className="flex items-center gap-2">
                          <Phone
                            className="size-3.5 text-muted-foreground"
                            aria-hidden
                          />
                          {claim.contactPhone}
                        </li>
                      )}
                      {claim.whatsapp && (
                        <li className="flex items-center gap-2">
                          <MessagesSquare
                            className="size-3.5 text-muted-foreground"
                            aria-hidden
                          />
                          {claim.whatsapp}
                        </li>
                      )}
                      {claim.openingHours && (
                        <li className="flex items-center gap-2">
                          <Clock
                            className="size-3.5 text-muted-foreground"
                            aria-hidden
                          />
                          {claim.openingHours}
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {t("claimNoContact")}
                    </p>
                  )}
                </div>

                <Link
                  href={`/mapa?lugar=${claim.placeSlug}`}
                  className="flex w-fit items-center gap-1.5 font-medium text-sm underline underline-offset-4"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  {t("openOnMap")}
                </Link>

                {isRejecting && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={`note-${claim.id}`}
                      className="font-medium text-sm"
                    >
                      {t("noteLabel")}
                    </label>
                    <Textarea
                      id={`note-${claim.id}`}
                      value={note}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [claim.id]: event.target.value,
                        }))
                      }
                      placeholder={t("notePlaceholder")}
                      minLength={10}
                      maxLength={500}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t("noteHint")}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="h-11 flex-1"
                    disabled={pending}
                    onClick={() =>
                      decideClaim.mutate({
                        claimId: claim.id,
                        decision: "approve",
                      })
                    }
                  >
                    <Check className="size-4" aria-hidden />
                    {t("approve")}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1"
                    disabled={
                      pending || (isRejecting && note.trim().length < 10)
                    }
                    onClick={() => {
                      if (!isRejecting) {
                        setRejecting(claim.id);
                        return;
                      }
                      decideClaim.mutate({
                        claimId: claim.id,
                        decision: "reject",
                        note: note.trim(),
                      });
                    }}
                  >
                    <X className="size-4" aria-hidden />
                    {isRejecting ? t("confirmReject") : t("reject")}
                  </Button>
                </div>
              </article>
            );
          })}
        </TabsContent>

        {/* Cases are answered on the case's own page, not here: a reply written
            next to the thing it answers is a better reply, and this queue's job
            is to say which ones are waiting. */}
        <TabsContent value="consultations" className="flex flex-col gap-6">
          {consultations.map((item) => {
            const Icon = categoryIcon(item.categoryIcon);

            return (
              <article
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
              >
                <header className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${item.categoryColor}1a` }}
                  >
                    <Icon
                      className="size-5"
                      style={{ color: item.categoryColor }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-pretty font-medium text-lg leading-tight">
                      {item.title}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Meta>
                        <MapPin className="size-3.5" aria-hidden />
                        {item.municipalityName}
                      </Meta>
                      <Meta>
                        <Clock className="size-3.5" aria-hidden />
                        {format.relativeTime(new Date(item.createdAt))}
                      </Meta>
                      {item.openedBy && <Meta>{item.openedBy}</Meta>}
                    </div>
                  </div>
                </header>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <Badge variant="secondary">{item.categoryName}</Badge>
                  <Badge variant="outline" className="tabular-nums">
                    <Users className="size-3.5" aria-hidden />
                    {t("supportCount", { count: item.supportCount })}
                  </Badge>
                </div>

                <p className="line-clamp-4 text-pretty text-[15px] leading-relaxed">
                  {item.body}
                </p>

                <Button
                  className="h-11 w-full sm:w-fit"
                  nativeButton={false}
                  render={<Link href={`/consultas/${item.slug}`} />}
                >
                  <MessagesSquare className="size-4" aria-hidden />
                  {t("respond")}
                </Button>
              </article>
            );
          })}
        </TabsContent>

        {/* Not a queue of things waiting for permission: these are already on
            the map. It is the list a moderator scans for the one that should
            not be, so every card leads with "quitar" rather than "aprobar". */}
        <TabsContent value="traffic" className="flex flex-col gap-6">
          {traffic.map((report) => {
            const Icon = categoryIcon(report.categoryIcon);
            const isRemoving = rejecting === report.id;
            const note = notes[report.id] ?? "";

            return (
              <article
                key={report.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
              >
                <header className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${report.categoryColor}1a` }}
                  >
                    <Icon
                      className="size-5"
                      style={{ color: report.categoryColor }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-lg leading-tight">
                      {report.categoryName}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Meta>
                        <MapPin className="size-3.5" aria-hidden />
                        {report.municipalityName}
                      </Meta>
                      <Meta>
                        <Clock className="size-3.5" aria-hidden />
                        {format.relativeTime(new Date(report.createdAt))}
                      </Meta>
                      <Meta>
                        <TrafficCone className="size-3.5" aria-hidden />
                        {format.relativeTime(new Date(report.expiresAt))}
                      </Meta>
                      {report.reportedBy && (
                        <Meta>
                          {report.reporterTier === "citizen" && (
                            <ShieldCheck
                              className="size-3.5 text-emerald-600"
                              aria-hidden
                            />
                          )}
                          {report.reportedBy}
                        </Meta>
                      )}
                    </div>
                  </div>
                </header>

                {report.description && (
                  <p className="text-pretty text-[15px] leading-relaxed">
                    {report.description}
                  </p>
                )}

                <Link
                  href={`/mapa?reporte=${report.id}`}
                  className="flex w-fit items-center gap-1.5 font-medium text-sm underline underline-offset-4"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  {t("openOnMap")}
                </Link>

                {isRemoving && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={`note-${report.id}`}
                      className="font-medium text-sm"
                    >
                      {t("removeNoteLabel")}
                    </label>
                    <Textarea
                      id={`note-${report.id}`}
                      value={note}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [report.id]: event.target.value,
                        }))
                      }
                      placeholder={t("removeNotePlaceholder")}
                      minLength={10}
                      maxLength={500}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t("noteHint")}
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="h-11 w-full"
                  disabled={pending || (isRemoving && note.trim().length < 10)}
                  onClick={() => {
                    if (!isRemoving) {
                      setRejecting(report.id);
                      return;
                    }
                    removeTraffic.mutate({
                      reportId: report.id,
                      note: note.trim(),
                    });
                  }}
                >
                  <X className="size-4" aria-hidden />
                  {isRemoving ? t("confirmRemove") : t("removeTraffic")}
                </Button>
              </article>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

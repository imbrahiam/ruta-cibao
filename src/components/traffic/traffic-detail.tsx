"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, ShieldX } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { CategoryIcon } from "@/components/places/category-icon";
import { Avatar } from "@/components/shell/account-menu";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { useRouter } from "@/i18n/navigation";
import { errorReason } from "@/lib/errors";
import { TRAFFIC_COLORS, trafficTone } from "@/lib/map/traffic-colors";
import { newIdempotencyKey } from "@/lib/offline/submit";
import { orpc } from "@/lib/orpc";
import type { TrafficReport } from "./traffic-layer";

/**
 * One report, said in words: what, how bad, where, since when, and who says
 * so. The two buttons are the whole point of the feature: whoever drove past
 * last can say "still like this" or "it's clear now".
 */
export function TrafficDetail({ report }: { report: TrafficReport }) {
  const t = useTranslations("traffic");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { isSignedIn, isStaff } = useAuth();
  const signInHref = useSignInHref();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);
  const tone = trafficTone(report.state, report.severity);

  const confirm = useMutation(
    orpc.traffic.confirm.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.traffic.key() });
        toast.success({
          title:
            result.status === "cleared" ? t("thanksCleared") : t("thanksStill"),
        });
      },
      onError: (error) => {
        const reason = errorReason(error);
        toast.error({
          title: t(`errors.${reason ?? "unknown"}` as "errors.unknown"),
        });
      },
    }),
  );

  const vote = (verdict: "still" | "cleared") => {
    if (!isSignedIn) {
      router.push(signInHref as "/entrar");
      return;
    }
    confirm.mutate({ reportId: report.id, verdict });
  };

  return (
    <article className="px-5 pt-2 pb-6 md:pt-5">
      <div className="flex items-center gap-2 pr-10">
        <span
          className="flex size-7 items-center justify-center rounded-[9px] text-white"
          style={{ backgroundColor: TRAFFIC_COLORS[tone] }}
        >
          <CategoryIcon
            icon={report.categoryIcon}
            className="size-4"
            strokeWidth={2}
          />
        </span>
        <span
          className="text-[14px] font-medium"
          style={{
            color: `color-mix(in srgb, ${TRAFFIC_COLORS[tone]} 80%, var(--ink))`,
          }}
        >
          {t(`tones.${tone}`)}
        </span>
      </div>
      <h2 className="t-h3 mt-2 text-ink">{report.categoryName}</h2>
      <p className="t-small mt-1 text-ink-2">
        {report.lengthMeters
          ? t("where", {
              length:
                report.lengthMeters >= 1000
                  ? format.number(report.lengthMeters / 1000, "distance")
                  : `${report.lengthMeters} m`,
              municipality: report.municipalityName,
            })
          : t("wherePoint", { municipality: report.municipalityName })}
      </p>
      {report.description ? (
        <p className="t-body mt-4 rounded-card bg-paper-2 px-4 py-3 text-ink">
          {report.description}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-card bg-paper-2 px-4 py-3">
          <dt className="t-label text-ink-3">{t("reported")}</dt>
          <dd className="mt-1 text-[15px] text-ink">
            {format.relativeTime(new Date(report.createdAt), now)}
          </dd>
        </div>
        <div className="rounded-card bg-paper-2 px-4 py-3">
          <dt className="t-label text-ink-3">
            {report.state === "cleared" ? t("clearedLabel") : t("expires")}
          </dt>
          <dd className="mt-1 text-[15px] text-ink">
            {format.relativeTime(new Date(report.expiresAt), now)}
          </dd>
        </div>
      </dl>

      <section className="mt-5">
        <h3 className="t-label text-ink-3">
          {t("voices", { count: report.voiceCount })}
        </h3>
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {report.voices.slice(0, 8).map((voice) => (
            <li
              key={voice.key}
              className="flex items-center gap-2 rounded-full bg-paper-2 py-1 pr-3 pl-1"
            >
              <Avatar
                name={voice.name}
                image={voice.image}
                className="size-6 text-[12px]"
              />
              <span className="text-[14px] text-ink">
                {voice.name ?? t("anonymous")}
              </span>
              {voice.tier === "citizen" ? (
                <BadgeCheck
                  strokeWidth={1.75}
                  className="size-3.5 text-accent"
                  aria-label={t("citizen")}
                />
              ) : null}
            </li>
          ))}
        </ul>
        <p className="t-small mt-2 text-ink-3">
          {t("tally", {
            still: report.stillCount,
            cleared: report.clearedCount,
          })}
        </p>
      </section>

      {report.isMine ? (
        <p className="t-small mt-5 rounded-card bg-paper-2 px-4 py-3 text-ink-2">
          {t("yours")}
        </p>
      ) : (
        <div className="mt-5">
          <p className="text-[15px] font-medium text-ink">{t("ask")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant={report.myVerdict === "still" ? "primary" : "secondary"}
              aria-pressed={report.myVerdict === "still"}
              disabled={confirm.isPending}
              onClick={() => vote("still")}
            >
              {report.myVerdict === "still" ? (
                <Check strokeWidth={1.75} />
              ) : null}
              {t("still")}
            </Button>
            <Button
              variant={report.myVerdict === "cleared" ? "primary" : "secondary"}
              aria-pressed={report.myVerdict === "cleared"}
              disabled={confirm.isPending}
              onClick={() => vote("cleared")}
            >
              {report.myVerdict === "cleared" ? (
                <Check strokeWidth={1.75} />
              ) : null}
              {t("cleared")}
            </Button>
          </div>
        </div>
      )}

      {isStaff ? (
        <>
          <Button
            variant="danger"
            size="sm"
            className="mt-6"
            onClick={() => setRemoving(true)}
          >
            <ShieldX strokeWidth={1.5} />
            {t("remove")}
          </Button>
          <RemoveSheet
            open={removing}
            onOpenChange={setRemoving}
            reportId={report.id}
          />
        </>
      ) : null}
    </article>
  );
}

function RemoveSheet({
  open,
  onOpenChange,
  reportId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
}) {
  const t = useTranslations("traffic.removeForm");
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const remove = useMutation(
    orpc.moderation.removeTraffic.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.traffic.key() });
        toast.success({ title: t("done") });
        onOpenChange(false);
      },
      onError: () => toast.error({ title: t("failed") }),
    }),
  );
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={note.trim().length < 10 || remove.isPending}
            onClick={() =>
              remove.mutate({
                requestId: newIdempotencyKey(),
                reportId,
                note: note.trim(),
              })
            }
          >
            {t("submit")}
          </Button>
        </>
      }
    >
      <Field htmlFor="remove-note" label={t("note")} hint={t("noteHint")}>
        <Textarea
          id="remove-note"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </Sheet>
  );
}

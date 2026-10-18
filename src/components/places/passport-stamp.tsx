"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stamp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { errorReason } from "@/lib/errors";
import { client, orpc } from "@/lib/orpc";

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000,
    }),
  );
}

/**
 * The tourist passport, at the place itself: one private stamp per place,
 * given only when the phone is within 150 m. A souvenir, not proof, and the
 * copy never pretends otherwise.
 */
export function PassportStamp({
  placeId,
  location,
}: {
  placeId: string;
  location: { lng: number; lat: number };
}) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return null;
  return <StampCard placeId={placeId} location={location} />;
}

function StampCard({
  placeId,
}: {
  placeId: string;
  location: { lng: number; lat: number };
}) {
  const t = useTranslations("place.passport");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const status = useQuery(
    orpc.passport.status.queryOptions({ input: { placeId } }),
  );
  const [problem, setProblem] = useState<string | null>(null);

  const stamp = useMutation({
    mutationFn: async () => {
      if (!window.isSecureContext || !("geolocation" in navigator))
        throw new Error("insecure");
      const position = await currentPosition().catch(
        (error: GeolocationPositionError) => {
          throw new Error(
            error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
          );
        },
      );
      return client.passport.stamp({
        placeId,
        position: {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        },
        accuracyMeters: Math.max(1, position.coords.accuracy),
        capturedAt: new Date(position.timestamp).toISOString(),
      });
    },
    onSuccess: () => {
      setProblem(null);
      queryClient.invalidateQueries({ queryKey: orpc.passport.key() });
    },
    onError: (error) => {
      const reason =
        errorReason(error) ??
        (error instanceof Error ? error.message : "unknown");
      setProblem(reason);
    },
  });

  const stampedAt = status.data?.stampedAt;

  return (
    <section className="mx-5 mt-6 flex items-center gap-4 rounded-card bg-paper-2 p-4">
      <span
        aria-hidden
        className={
          stampedAt
            ? "flex size-14 shrink-0 -rotate-6 items-center justify-center rounded-full border-[1.5px] border-dashed border-accent text-accent"
            : "flex size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-ink-4 text-ink-3"
        }
      >
        <Stamp strokeWidth={1.5} className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">
          {stampedAt ? t("stamped") : t("title")}
        </p>
        <p className="t-small mt-0.5 text-ink-2">
          {stampedAt
            ? t("stampedOn", {
                date: format.dateTime(new Date(stampedAt), "short"),
              })
            : problem
              ? t(`problems.${problem}` as "problems.unknown")
              : t("hint")}
        </p>
        {stampedAt ? (
          <Link
            href="/pasaporte"
            className="t-small mt-1 inline-block text-accent hover:underline"
          >
            {t("open")}
          </Link>
        ) : null}
      </div>
      {stampedAt ? null : (
        <Button
          size="sm"
          variant="primary"
          disabled={stamp.isPending}
          onClick={() => stamp.mutate()}
        >
          {stamp.isPending ? t("checking") : t("action")}
        </Button>
      )}
    </section>
  );
}

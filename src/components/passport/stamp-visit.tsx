"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Stamp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { requestPosition } from "@/lib/geolocation";
import { markInstallMoment } from "@/lib/install-moment";
import { orpc } from "@/lib/orpc";

export function StampVisit({
  placeId,
  slug,
}: {
  placeId: string;
  slug: string;
}) {
  const t = useTranslations("passport");
  const locationT = useTranslations("location");
  const format = useFormatter();
  const { viewer, isLoading } = useAuth();
  const signedIn = viewer !== undefined && viewer.kind !== "anonymous";
  const queryClient = useQueryClient();
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const status = useQuery({
    ...orpc.passport.status.queryOptions({ input: { placeId } }),
    enabled: signedIn,
  });
  const stamp = useMutation(
    orpc.passport.stamp.mutationOptions({
      onSuccess: async (result) => {
        setProblem(null);
        queryClient.setQueryData(
          orpc.passport.status.queryKey({ input: { placeId } }),
          { stampedAt: result.stampedAt },
        );
        await queryClient.invalidateQueries({
          queryKey: orpc.passport.list.key(),
        });
        toast.success(t(result.created ? "success" : "already"));
        markInstallMoment();
      },
      onError: (error) => {
        const reason =
          "data" in error &&
          error.data &&
          typeof error.data === "object" &&
          "reason" in error.data
            ? error.data.reason
            : null;
        setProblem(
          t(
            reason === "inaccurate"
              ? "inaccurate"
              : reason === "stale"
                ? "stale"
                : reason === "too_far"
                  ? "tooFar"
                  : "error",
          ),
        );
      },
    }),
  );
  const busy = locating || stamp.isPending;

  function collect() {
    setProblem(null);
    setLocating(true);
    // Keep the GPS request in the click's synchronous call stack for Safari.
    void requestPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    }).then((fix) => {
      setLocating(false);
      if (!fix.ok) {
        setProblem(locationT(fix.problem));
        return;
      }
      stamp.mutate({
        placeId,
        position: fix.position,
        accuracyMeters: fix.accuracyMeters,
        capturedAt: new Date(fix.capturedAt).toISOString(),
      });
    });
  }

  if (isLoading) return null;
  return (
    <section>
      <div className="flex items-center gap-2 font-semibold text-sm">
        <Stamp className="size-4 text-primary" aria-hidden />
        {t("shortTitle")}
      </div>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
        {t("visitHint")}
      </p>
      {status.data?.stampedAt ? (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 text-primary text-sm"
        >
          <Check className="size-4" aria-hidden />
          {t("collectedOn", {
            date: format.dateTime(new Date(status.data.stampedAt), {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          })}
        </p>
      ) : signedIn ? (
        <Button
          className="mt-3 h-11 rounded-full"
          variant="outline"
          disabled={busy || status.isPending || status.isError}
          onClick={collect}
        >
          {busy ? (
            <Spinner className="size-4" />
          ) : (
            <Stamp className="size-4" aria-hidden />
          )}
          {t(busy ? "checking" : "collect")}
        </Button>
      ) : (
        <Button
          className="mt-3 h-11 rounded-full"
          variant="outline"
          nativeButton={false}
          render={
            <Link
              href={`/entrar?callbackUrl=${encodeURIComponent(`/mapa?lugar=${slug}`)}`}
            />
          }
        >
          {t("signIn")}
        </Button>
      )}
      {status.isError && (
        <div role="alert" className="mt-3 text-destructive text-sm">
          {t("error")}{" "}
          <Button variant="link" onClick={() => void status.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-destructive text-sm">
          {problem}
        </p>
      )}
      <Link
        href="/pasaporte"
        className="mt-2 flex min-h-11 items-center text-primary text-sm underline underline-offset-4"
      >
        {t("open")}
      </Link>
    </section>
  );
}

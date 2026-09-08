"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  Clock,
  Route,
  ShieldCheck,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSignInHref } from "@/hooks/use-sign-in-href";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { client, orpc } from "@/lib/orpc";

/**
 * One traffic report, opened.
 *
 * Two buttons and one sentence, because that is the whole interaction: somebody
 * driving past says whether it is still true. "Sigue ahí" pushes the report's
 * lapse date forward, "Ya pasó" counts towards taking it down — and once enough
 * weight agrees, it comes off the map without a moderator having to be involved.
 *
 * The countdown is the honest part of the design. Every report says when it will
 * disappear, so nobody has to wonder whether what they are looking at is from
 * this afternoon or last Tuesday.
 */
export type TrafficSelection = {
  id: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  description: string | null;
  /** Metres of road affected, when the report is a stretch. */
  lengthMeters: number | null;
  /** A cleared road is still on the map for a few hours, as information. */
  state: "active" | "cleared";
  createdAt: string;
  expiresAt: string;
  reportedBy: string | null;
  reporterTier: "visitor" | "citizen" | null;
  voices: {
    key: string;
    name: string | null;
    image: string | null;
    tier: "visitor" | "citizen";
  }[];
  voiceCount: number;
  stillCount: number;
  clearedCount: number;
  myVerdict: "still" | "cleared" | null;
  isMine: boolean;
};

export function TrafficDrawer({
  report,
  onClose,
}: {
  report: TrafficSelection | null;
  onClose: () => void;
}) {
  const t = useTranslations("map.traffic");
  const format = useFormatter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const { viewer } = useAuth();

  const confirm = useMutation({
    mutationFn: (verdict: "still" | "cleared") =>
      client.traffic.confirm({ reportId: report?.id ?? "", verdict }),
    onSuccess: async (result) => {
      toast.success(
        result.status === "cleared" ? t("clearedToast") : t("thanks"),
      );
      await queryClient.invalidateQueries({
        queryKey: orpc.traffic.active.key(),
      });
      if (result.status === "cleared") onClose();
    },
    onError: () => toast.error(t("confirmFailed")),
  });

  const Icon = categoryIcon(report?.categoryIcon);
  const signedIn = viewer && viewer.kind !== "anonymous";

  return (
    <Drawer
      open={report !== null}
      onOpenChange={(open) => !open && onClose()}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerContent>
        {report && (
          <>
            <DrawerHeader className="border-b">
              <div className="flex items-start gap-3 text-left">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `${report.categoryColor}1f`,
                    color: report.categoryColor,
                  }}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <DrawerTitle className="text-lg">
                    {report.categoryName}
                  </DrawerTitle>
                  {report.description && (
                    <DrawerDescription className="text-pretty leading-relaxed">
                      {report.description}
                    </DrawerDescription>
                  )}
                </div>
              </div>
            </DrawerHeader>

            <div className="space-y-5 overflow-y-auto px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="space-y-2 text-muted-foreground text-sm">
                <p className="flex items-center gap-2">
                  {/* A verified resident's report reads differently from a
                      passer-by's, and the reader is the one who should weigh
                      that rather than the platform hiding the difference. */}
                  {report.reporterTier === "citizen" && (
                    <ShieldCheck
                      className="size-4 shrink-0 text-emerald-600"
                      aria-label={t("residentBadge")}
                    />
                  )}
                  {report.reportedBy
                    ? t("reportedBy", { name: report.reportedBy })
                    : t("reportedByAnon")}
                  {" · "}
                  {format.relativeTime(new Date(report.createdAt))}
                </p>
                {/* A stretch says how much road, because that is the fact a
                    driver is deciding on. A point says nothing here. */}
                {report.lengthMeters !== null && (
                  <p className="flex items-center gap-2">
                    <Route className="size-4 shrink-0" aria-hidden />
                    {t("affects", { meters: report.lengthMeters })}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0" aria-hidden />
                  {t("expiresIn", {
                    time: format.relativeTime(new Date(report.expiresAt)),
                  })}
                </p>
              </div>

              {/* Who is behind this, as faces.
                  
                  A count alone reads as a statistic; a row of people reads as
                  neighbours, which is what it is and what makes a stranger's
                  report worth acting on. Overlapped rather than spaced, so a
                  handful of them costs one line however many there are.
                  
                  The tick marks a verified resident, because that is what the
                  tally already weighs double — a reader deciding whether to
                  turn around should be able to see the difference rather than
                  take the number on faith. */}
              {report.voiceCount > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <ul className="flex items-center -space-x-2">
                    {report.voices.map((voice, index) => (
                      <li
                        key={voice.key}
                        className="relative"
                        // Stacked left over right, so the row reads in order.
                        style={{ zIndex: report.voices.length - index }}
                      >
                        <span
                          title={voice.name ?? undefined}
                          className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-background"
                        >
                          {voice.image ? (
                            // biome-ignore lint/performance/noImgElement: a 32px avatar in a drawer is not a content image, and next/image would wrap it in a layout box and a loader.
                            <img
                              src={voice.image}
                              alt=""
                              width={32}
                              height={32}
                              referrerPolicy="no-referrer"
                              className="size-full object-cover"
                            />
                          ) : (
                            <UserRound
                              className="size-4 text-muted-foreground"
                              aria-hidden
                            />
                          )}
                        </span>
                        {voice.tier === "citizen" && (
                          <ShieldCheck
                            className="-right-0.5 -bottom-0.5 absolute size-3.5 rounded-full bg-background text-emerald-600"
                            aria-label={t("residentBadge")}
                          />
                        )}
                      </li>
                    ))}
                  </ul>

                  <p className="text-muted-foreground text-sm">
                    {t("voiceCount", { count: report.voiceCount })}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="tabular-nums">
                  {t("stillCount", { count: report.stillCount })}
                </Badge>
                {report.clearedCount > 0 && (
                  <Badge variant="outline" className="tabular-nums">
                    {t("clearedCount", { count: report.clearedCount })}
                  </Badge>
                )}
              </div>

              {/* A road neighbours have already called clear is not asking
                  anything. It is on the map to answer "can I go that way now",
                  and the vote it would offer has no meaning any more. */}
              {report.state === "cleared" ? (
                <p
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-emerald-700 text-sm dark:text-emerald-400"
                  role="status"
                >
                  <CheckCheck className="size-4 shrink-0" aria-hidden />
                  {t("alreadyClearedNote")}
                </p>
              ) : report.isMine ? (
                <p
                  className="rounded-xl border bg-muted/40 p-4 text-center text-muted-foreground text-sm"
                  role="status"
                >
                  {t("ownReport")}
                </p>
              ) : signedIn ? (
                // 48px targets, side by side: this is tapped one-handed, often
                // by someone who has just pulled over.
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={
                      report.myVerdict === "still" ? "default" : "outline"
                    }
                    className="h-12"
                    disabled={confirm.isPending}
                    onClick={() => confirm.mutate("still")}
                  >
                    {confirm.isPending && confirm.variables === "still" ? (
                      <Spinner className="size-4" />
                    ) : (
                      <ThumbsUp className="size-4" aria-hidden />
                    )}
                    {t("stillThere")}
                  </Button>
                  <Button
                    variant={
                      report.myVerdict === "cleared" ? "default" : "outline"
                    }
                    className="h-12"
                    disabled={confirm.isPending}
                    onClick={() => confirm.mutate("cleared")}
                  >
                    {confirm.isPending && confirm.variables === "cleared" ? (
                      <Spinner className="size-4" />
                    ) : (
                      <CheckCheck className="size-4" aria-hidden />
                    )}
                    {t("alreadyCleared")}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="h-12 w-full"
                  nativeButton={false}
                  render={<Link href={signInHref} />}
                >
                  {t("signInTitle")}
                </Button>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

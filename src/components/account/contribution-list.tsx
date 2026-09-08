"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList, MapPinPlus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/** Waiting on somebody else. */
const WAITING = new Set(["pending", "draft", "open", "in_review", "active"]);
/** Finished, and finished well. */
const SETTLED = new Set([
  "published",
  "resolved",
  "approved",
  "answered",
  "cleared",
]);
/** Finished, and not in the contributor's favour. */
const REFUSED = new Set(["rejected", "dismissed", "removed"]);

export function ContributionList() {
  const t = useTranslations("contributions");
  const format = useFormatter();
  const { viewer, isLoading } = useAuth();
  const member = Boolean(viewer && viewer.kind !== "anonymous");
  const [pendingOnly, setPendingOnly] = useState(false);
  const query = useQuery(
    orpc.places.contributions.queryOptions({ enabled: member }),
  );
  const items = query.data?.filter(
    (item) => !pendingOnly || item.status === "pending",
  );
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("intro")}
        </p>
      </header>
      {isLoading ? (
        <Spinner className="mx-auto size-5" />
      ) : !member ? (
        <section className="surface-card p-10 text-center">
          <h2 className="text-xl font-medium">{t("signIn")}</h2>
          <p className="my-4 text-sm text-muted-foreground">
            {t("signInHint")}
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/entrar?callbackUrl=%2Faportes" />}
          >
            {t("signIn")}
          </Button>
        </section>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-1 rounded-full bg-muted p-1">
              <Button
                variant="ghost"
                aria-pressed={!pendingOnly}
                className={cn(
                  "rounded-full px-4 hover:bg-foreground/10",
                  !pendingOnly && "bg-background shadow-sm hover:bg-background",
                )}
                onClick={() => setPendingOnly(false)}
              >
                {t("all")}
              </Button>
              <Button
                variant="ghost"
                aria-pressed={pendingOnly}
                className={cn(
                  "rounded-full px-4 hover:bg-foreground/10",
                  pendingOnly && "bg-background shadow-sm hover:bg-background",
                )}
                onClick={() => setPendingOnly(true)}
              >
                {t("pendingTab")}
              </Button>
            </div>
            <Button
              variant="outline"
              className="h-11 rounded-full px-4"
              nativeButton={false}
              render={<Link href="/mapa?agregar=true" />}
            >
              <MapPinPlus aria-hidden />
              {t("add")}
            </Button>
          </div>
          {query.isPending ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
            >
              <Spinner className="size-4" />
              {t("loading")}
            </p>
          ) : query.isError ? (
            <div role="alert" className="surface-card p-8 text-center">
              <p className="mb-4">{t("error")}</p>
              <Button onClick={() => void query.refetch()}>{t("retry")}</Button>
            </div>
          ) : items?.length === 0 ? (
            <section className="surface-card flex flex-col items-center px-6 py-16 text-center">
              <ClipboardList
                className="mb-5 size-8 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-xl font-medium">
                {pendingOnly ? t("pendingEmpty") : t("empty")}
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t("emptyHint")}
              </p>
            </section>
          ) : (
            <ul className="space-y-4">
              {items?.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="surface-card p-6"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {t(item.kind)} ·{" "}
                      {format.dateTime(item.createdAt, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "rounded-full px-2.5 py-1",
                        // Three tones over fifteen states: waiting, done,
                        // turned down. The word is the signal; the colour only
                        // groups it, which is what keeps the badge readable
                        // without relying on colour to say anything.
                        WAITING.has(item.status) &&
                          "bg-amber-50 text-amber-800",
                        SETTLED.has(item.status) &&
                          "bg-emerald-50 text-emerald-800",
                        REFUSED.has(item.status) && "bg-red-50 text-red-800",
                      )}
                    >
                      {t(item.status)}
                    </Badge>
                  </div>
                  <h2 className="font-medium text-lg">{item.name}</h2>
                  {item.note && (
                    <div className="mt-4 rounded-xl bg-muted p-4">
                      <h3 className="text-xs font-medium">{t("note")}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                        {item.note}
                      </p>
                    </div>
                  )}
                  {/* Where a contribution lives depends on what it is, so the
                      service says. A row with nowhere to go — a place still in
                      review, a traffic report that has lapsed — gets no link
                      rather than one that lands on "eso no existe". */}
                  {item.href && (
                    <Link
                      href={item.href}
                      className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary"
                    >
                      {t("open")}
                      <ArrowUpRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {query.data && query.data.length > 0 && (
            <p className="mt-6 text-xs text-muted-foreground">{t("recent")}</p>
          )}
        </>
      )}
    </div>
  );
}

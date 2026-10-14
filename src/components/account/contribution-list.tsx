"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  MapPin,
  MapPinPlus,
  MessagesSquare,
  PencilLine,
  Store,
  TriangleAlert,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { groupByRecency } from "@/components/ui-patterns/date-groups";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import {
  ListRow,
  ListRowSkeleton,
  RowPictogram,
} from "@/components/ui-patterns/list-row";
import { Segmented } from "@/components/ui-patterns/segmented";
import { StatusBadge, statusTone } from "@/components/ui-patterns/status-badge";
import { Link } from "@/i18n/navigation";
import { type client, orpc } from "@/lib/orpc";

type Contribution = Awaited<
  ReturnType<typeof client.places.contributions>
>[number];

/** One pictogram per kind of contribution, so the list scans by shape. */
const KIND_ICON: Record<Contribution["kind"], typeof MapPin> = {
  place: MapPin,
  report: PencilLine,
  photo: Camera,
  traffic: TriangleAlert,
  consultation: MessagesSquare,
  claim: Store,
};

/**
 * Everything you have put into the map, and where each thing stands.
 *
 * The "my requests" screen every civic reporting app has, and the reason to
 * come back: a ruled list, newest first, grouped by how recent. Each row is
 * the kind of thing (as a pictogram and a word), your own words for it, how
 * long ago, and the state in the same five tones the cases use.
 */
export function ContributionList() {
  const t = useTranslations("contributions");
  const groupT = useTranslations("lists");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { viewer, isLoading } = useAuth();
  const member = Boolean(viewer && viewer.kind !== "anonymous");
  const [pendingOnly, setPendingOnly] = useState(false);
  const query = useQuery(
    orpc.places.contributions.queryOptions({ enabled: member }),
  );
  const items =
    query.data?.filter((item) => !pendingOnly || item.status === "pending") ??
    [];
  const groups = groupByRecency(items, (item) => item.createdAt, now);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h1 className="page-title">{t("title")}</h1>
        {member && (
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            nativeButton={false}
            render={<Link href="/mapa?agregar=true" />}
          >
            <MapPinPlus className="size-[18px]" aria-hidden />
            {t("add")}
          </Button>
        )}
      </header>

      {isLoading ? (
        <ListRowSkeleton label={t("loading")} />
      ) : !member ? (
        <EmptyState
          illustration="contributions"
          title={t("signIn")}
          action={
            <Button
              className="h-11 rounded-full px-6"
              nativeButton={false}
              render={<Link href="/entrar?callbackUrl=%2Faportes" />}
            >
              {t("signInAction")}
            </Button>
          }
        />
      ) : (
        <>
          <Segmented
            className="mb-5 sm:max-w-xs"
            label={t("filter")}
            value={pendingOnly ? "pending" : "all"}
            onChange={(value) => setPendingOnly(value === "pending")}
            options={[
              { value: "all", label: t("all") },
              { value: "pending", label: t("pendingTab") },
            ]}
          />
          {query.isPending ? (
            <ListRowSkeleton label={t("loading")} />
          ) : query.isError ? (
            <EmptyState
              illustration="contributions"
              title={t("error")}
              action={
                <Button
                  className="rounded-full px-6"
                  onClick={() => void query.refetch()}
                >
                  {t("retry")}
                </Button>
              }
            />
          ) : items.length === 0 ? (
            pendingOnly ? (
              <EmptyState
                illustration="contributions"
                title={t("pendingEmpty")}
                action={
                  <Button
                    variant="outline"
                    className="rounded-full px-6"
                    onClick={() => setPendingOnly(false)}
                  >
                    {t("all")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                illustration="contributions"
                title={t("empty")}
                action={
                  <Button
                    className="rounded-full px-6"
                    nativeButton={false}
                    render={<Link href="/mapa?agregar=true" />}
                  >
                    {t("add")}
                  </Button>
                }
              />
            )
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <section
                  key={group.key}
                  aria-labelledby={`aportes-${group.key}`}
                >
                  <h2
                    id={`aportes-${group.key}`}
                    className="border-border border-b pb-2 font-semibold text-muted-foreground text-sm"
                  >
                    {groupT(group.key)}
                  </h2>
                  <ul className="ruled">
                    {group.items.map((item) => (
                      <li key={`${item.kind}-${item.id}`}>
                        {/* Where a contribution lives depends on what it is,
                            so the service says. A row with nowhere to go — a
                            place still in review, a traffic report that has
                            lapsed — is not a link rather than one that lands
                            on "eso no existe". */}
                        <ListRow
                          href={item.href ?? undefined}
                          headingLevel={3}
                          leading={<RowPictogram icon={KIND_ICON[item.kind]} />}
                          title={item.name}
                          meta={`${t(item.kind)} · ${format.relativeTime(item.createdAt, now)}`}
                          badge={
                            <StatusBadge
                              tone={statusTone(item.status)}
                              label={t(
                                item.status === "open"
                                  ? "openStatus"
                                  : item.status,
                              )}
                            />
                          }
                          trailing={item.href ? undefined : null}
                          detail={
                            item.note ? (
                              <p className="mt-2.5 border-border border-l-2 pl-3 text-[15px] text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground">
                                  {t("note")}:
                                </span>{" "}
                                <span className="whitespace-pre-wrap">
                                  {item.note}
                                </span>
                              </p>
                            ) : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

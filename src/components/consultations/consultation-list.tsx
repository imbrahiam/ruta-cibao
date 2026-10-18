"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { MessageSquareText, MessagesSquare, ThumbsUp } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useAuth } from "@/components/auth/auth-context";
import { CategoryIcon } from "@/components/places/category-icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { Segmented } from "@/components/ui/segmented";
import { Link } from "@/i18n/navigation";
import { client, orpc } from "@/lib/orpc";
import { OpenConsultationSheet } from "./open-consultation";
import { StatusTag } from "./status-tag";

const STATUSES = [
  "open",
  "in_review",
  "answered",
  "resolved",
  "rejected",
] as const;

export function ConsultationList() {
  const t = useTranslations("consultations");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { isSignedIn } = useAuth();
  const [scope, setScope] = useQueryState(
    "ver",
    parseAsString.withDefault("todas"),
  );
  const [status, setStatus] = useQueryState(
    "estado",
    parseAsString.withDefault(""),
  );
  const [category, setCategory] = useQueryState(
    "tema",
    parseAsString.withDefault(""),
  );
  const [municipality, setMunicipality] = useQueryState(
    "municipio",
    parseAsString.withDefault(""),
  );
  const [opening, setOpening] = useQueryState(
    "abrir",
    parseAsString.withOptions({ history: "push" }),
  );
  const categories = useQuery(orpc.consultations.categories.queryOptions());
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const mine = scope === "mias" && isSignedIn;

  const list = useInfiniteQuery({
    queryKey: [
      "consultations",
      "browse",
      { status, category, municipality, mine },
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      client.consultations.browse({
        status: (status || undefined) as (typeof STATUSES)[number] | undefined,
        category,
        municipality,
        mine,
        offset: pageParam,
        limit: 12,
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {isSignedIn ? (
          <Segmented
            label={t("scopeLabel")}
            value={mine ? "mias" : "todas"}
            onChange={(value) =>
              void setScope(value === "todas" ? null : value)
            }
            options={[
              { value: "todas", label: t("all") },
              { value: "mias", label: t("mine") },
            ]}
          />
        ) : (
          <span />
        )}
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Select
            aria-label={t("status")}
            value={status}
            onChange={(event) => void setStatus(event.target.value || null)}
            className="rounded-full md:w-44"
          >
            <option value="">{t("anyStatus")}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`statusLabels.${value}`)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t("municipality")}
            value={municipality}
            onChange={(event) =>
              void setMunicipality(event.target.value || null)
            }
            className="rounded-full md:w-48"
          >
            <option value="">{t("anyMunicipality")}</option>
            {(municipalities.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <div className="col-span-2 md:w-48">
            <Select
              aria-label={t("topic")}
              value={category}
              onChange={(event) => void setCategory(event.target.value || null)}
              className="rounded-full"
            >
              <option value="">{t("anyTopic")}</option>
              {(categories.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((key) => (
            <Placeholder key={key} className="h-32" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={t("empty")}
          body={t("emptyHint")}
          action={
            <Button variant="primary" onClick={() => void setOpening("1")}>
              {t("open")}
            </Button>
          }
        />
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/consultas/${item.slug}`}
                className="group flex gap-4 rounded-card bg-card p-4 shadow-ring transition-shadow hover:shadow-md md:p-5"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper-2"
                  style={{ color: item.categoryColor }}
                >
                  <CategoryIcon
                    icon={item.categoryIcon}
                    className="size-5"
                    strokeWidth={1.5}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusTag status={item.status} />
                    <span className="t-small text-ink-3">
                      {item.categoryName} · {item.municipalityName}
                    </span>
                  </span>
                  <span className="mt-2 block text-[17px] leading-snug font-medium tracking-[-0.012em] text-ink">
                    {item.title}
                  </span>
                  <span className="t-small mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-3">
                    <span className="inline-flex items-center gap-1.5">
                      <ThumbsUp strokeWidth={1.5} className="size-4" />
                      {t("supporters", { count: item.supportCount })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquareText strokeWidth={1.5} className="size-4" />
                      {t("responses", { count: item.responseCount })}
                    </span>
                    <span>
                      {format.relativeTime(new Date(item.createdAt), now)}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage ? (
        <Button
          className="self-center"
          onClick={() => void list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
        >
          {t("more")}
        </Button>
      ) : null}
      <OpenConsultationSheet
        open={Boolean(opening)}
        onClose={() => void setOpening(null)}
      />
    </div>
  );
}

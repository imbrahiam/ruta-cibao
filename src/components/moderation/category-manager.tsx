"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { CategoryIcon } from "@/components/places/category-icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { toast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { newIdempotencyKey } from "@/lib/offline/submit";
import { orpc } from "@/lib/orpc";

const KINDS = [
  "place",
  "business",
  "route",
  "traffic",
  "consultation",
] as const;
type Kind = (typeof KINDS)[number];
const ICONS = [
  "map-pin",
  "mountain",
  "route",
  "store",
  "droplets",
  "triangle-alert",
  "construction",
  "trees",
  "messages-square",
] as const;
type Icon = (typeof ICONS)[number];
type Draft = {
  id?: string;
  name: string;
  icon: Icon | "";
  color: string;
  severity: "blocking" | "partial" | "minor" | null;
  sortOrder: number;
  isActive: boolean;
};

/**
 * The vocabulary of the platform, edited by the municipality without a deploy:
 * what kinds of places, routes, road problems and cases exist, their colour
 * and icon, and for road problems how bad each one is.
 */
export function CategoryManager() {
  const t = useTranslations("catalog");
  const { viewer, isLoading } = useAuth();
  const [kind, setKind] = useState<Kind>("place");
  const [draft, setDraft] = useState<Draft | null>(null);
  const isAdmin = viewer?.staffRole === "admin";
  const list = useQuery({
    ...orpc.catalog.list.queryOptions({ input: { kind } }),
    enabled: isAdmin,
  });

  if (isLoading) return <Placeholder className="h-96" />;
  if (!isAdmin) return <EmptyState icon={Tags} title={t("forbidden")} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/moderacion"
          className="t-small inline-flex items-center gap-1.5 text-ink-2 hover:text-ink"
        >
          <ArrowLeft strokeWidth={1.5} className="size-4" />
          {t("back")}
        </Link>
        <Button
          variant="primary"
          onClick={() =>
            setDraft({
              name: "",
              icon: "",
              color: "#1f6b52",
              severity: kind === "traffic" ? "minor" : null,
              sortOrder: (list.data?.length ?? 0) * 10,
              isActive: true,
            })
          }
        >
          <Plus strokeWidth={1.75} />
          {t("new")}
        </Button>
      </div>
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
        <Segmented
          label={t("kind")}
          value={kind}
          onChange={setKind}
          options={KINDS.map((value) => ({
            value,
            label: t(`kinds.${value}`),
          }))}
        />
      </div>
      {list.isPending ? (
        <Placeholder className="h-64" />
      ) : (
        <ul className="divide-y divide-line/60 overflow-hidden rounded-card bg-card shadow-ring">
          {(list.data ?? []).map((category) => (
            <li
              key={category.id}
              className={cx(
                "flex items-center gap-3 px-4 py-3",
                !category.isActive && "opacity-55",
              )}
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: category.color }}
              >
                <CategoryIcon icon={category.icon} className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink">
                  {category.name}
                </span>
                <span className="t-small block font-mono text-ink-3">
                  {category.id}
                </span>
              </span>
              {category.severity ? (
                <Tag
                  tone={category.severity === "blocking" ? "danger" : "warning"}
                >
                  {t(`severity.${category.severity}`)}
                </Tag>
              ) : null}
              {!category.isActive ? <Tag>{t("inactive")}</Tag> : null}
              <button
                type="button"
                aria-label={t("edit", { name: category.name })}
                onClick={() =>
                  setDraft({
                    id: category.id,
                    name: category.name,
                    icon: (ICONS as readonly string[]).includes(category.icon)
                      ? (category.icon as Icon)
                      : "",
                    color: category.color,
                    severity: category.severity,
                    sortOrder: category.sortOrder,
                    isActive: category.isActive,
                  })
                }
                className="press flex size-10 items-center justify-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink"
              >
                <Pencil strokeWidth={1.5} className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {draft ? (
        <EditSheet kind={kind} draft={draft} onClose={() => setDraft(null)} />
      ) : null}
    </div>
  );
}

function EditSheet({
  kind,
  draft: initial,
  onClose,
}: {
  kind: Kind;
  draft: Draft;
  onClose: () => void;
}) {
  const t = useTranslations("catalog");
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const save = useMutation(
    orpc.catalog.save.mutationOptions({
      onSuccess: () => {
        toast.success({ title: t("saved") });
        void queryClient.invalidateQueries({ queryKey: orpc.catalog.key() });
        onClose();
      },
      onError: () => toast.error({ title: t("failed") }),
    }),
  );
  const valid =
    draft.name.trim().length >= 2 &&
    draft.icon !== "" &&
    /^#[0-9a-fA-F]{6}$/.test(draft.color);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={draft.id ? t("editTitle") : t("newTitle")}
      description={t(`kinds.${kind}`)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate({
                requestId: newIdempotencyKey(),
                id: draft.id,
                kind,
                name: draft.name.trim(),
                icon: draft.icon as Icon,
                color: draft.color,
                severity:
                  kind === "traffic" ? (draft.severity ?? "minor") : null,
                sortOrder: draft.sortOrder,
                isActive: draft.isActive,
              })
            }
          >
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field htmlFor="category-name" label={t("name")}>
          <Input
            id="category-name"
            value={draft.name}
            maxLength={80}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[14px] font-medium text-ink">
            {t("icon")}
          </legend>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                aria-pressed={draft.icon === icon}
                aria-label={icon}
                onClick={() => setDraft({ ...draft, icon })}
                className={cx(
                  "press flex aspect-square items-center justify-center rounded-[12px] shadow-ring",
                  draft.icon === icon
                    ? "bg-ink text-paper"
                    : "bg-card text-ink-2 hover:bg-paper-2",
                )}
              >
                <CategoryIcon icon={icon} className="size-5" />
              </button>
            ))}
          </div>
          {draft.icon === "" ? (
            <p className="t-small mt-2 text-ink-3">{t("iconHint")}</p>
          ) : null}
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <Field htmlFor="category-color" label={t("color")}>
            <div className="flex items-center gap-2">
              <input
                id="category-color"
                type="color"
                value={draft.color}
                onChange={(event) =>
                  setDraft({ ...draft, color: event.target.value })
                }
                className="h-11 w-14 cursor-pointer rounded-input bg-card p-1 shadow-ring"
              />
              <span className="font-mono text-[12px] text-ink-3">
                {draft.color}
              </span>
            </div>
          </Field>
          <Field htmlFor="category-order" label={t("order")}>
            <Input
              id="category-order"
              type="number"
              min={0}
              max={1000}
              value={draft.sortOrder}
              onChange={(event) =>
                setDraft({ ...draft, sortOrder: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        {kind === "traffic" ? (
          <Field
            htmlFor="category-severity"
            label={t("severityLabel")}
            hint={t("severityHint")}
          >
            <Select
              id="category-severity"
              value={draft.severity ?? "minor"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  severity: event.target.value as Draft["severity"],
                })
              }
            >
              {(["blocking", "partial", "minor"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`severity.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <div className="flex items-center justify-between rounded-card bg-paper-2 px-4 py-3">
          <span className="text-[15px] text-ink">{t("active")}</span>
          <Switch
            aria-label={t("active")}
            checked={draft.isActive}
            onCheckedChange={(value) => setDraft({ ...draft, isActive: value })}
          />
        </div>
      </div>
    </Sheet>
  );
}

"use client";

import type { ApiInputs, ApiOutputs } from "@ruta/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { InlineError } from "@/components/admin/error-panel";
import { useOutcome } from "@/components/admin/outcome";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { api, orpc } from "@/lib/web/api";
import { failureKind, failureReason } from "@/lib/web/errors";

export type CategoryRecord = ApiOutputs["catalog"]["list"][number];
export type CategoryKind = CategoryRecord["kind"];
type SaveInput = Omit<ApiInputs["catalog"]["save"], "requestId">;
type Icon = SaveInput["icon"];
type Severity = NonNullable<SaveInput["severity"]>;

/** The icons the contract accepts; each has a label under `admin`. */
export const ICONS: readonly Icon[] = [
  "map-pin",
  "mountain",
  "route",
  "store",
  "droplets",
  "triangle-alert",
  "construction",
  "trees",
  "messages-square",
];
const SEVERITIES: readonly Severity[] = ["blocking", "partial", "minor"];
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Create or edit one category, inline under its row.
 *
 * Severity only exists for traffic; every other kind saves `null`. Colour is
 * chosen with the platform picker and written out as hex beside it, so the
 * value is never only a swatch.
 */
export function CategoryForm({
  kind,
  record,
  onClose,
}: {
  kind: CategoryKind;
  record?: CategoryRecord;
  /** Called after a save and on cancel, so the caller can return focus. */
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cat");
  const common = useTranslations("common");
  const announce = useOutcome();
  const queryClient = useQueryClient();
  const uid = useId();

  const [name, setName] = useState(record?.name ?? "");
  const [icon, setIcon] = useState<Icon>(
    ICONS.find((item) => item === record?.icon) ?? "map-pin",
  );
  const [color, setColor] = useState(record?.color ?? "#1F6B52");
  const [severity, setSeverity] = useState<Severity | "">(
    record?.severity ?? "",
  );
  const [sortOrder, setSortOrder] = useState(String(record?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(record?.isActive ?? true);
  const [attempted, setAttempted] = useState(false);

  const needsSeverity = kind === "traffic";
  const order = Number(sortOrder);
  const errors = {
    name:
      name.trim().length < 2 || name.trim().length > 80 ? c("errName") : null,
    color: HEX.test(color) ? null : c("errColor"),
    severity: needsSeverity && severity === "" ? c("errSeverity") : null,
    sortOrder:
      /^\d+$/.test(sortOrder) && order >= 0 && order <= 1000
        ? null
        : c("errSortOrder"),
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = useStaffMutation<SaveInput, { id: string }>(
    (input) => api.catalog.save(input),
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.catalog.key() });
        announce(t("saved"));
        onClose();
      },
    },
  );

  const duplicate =
    failureKind(save.error) === "conflict" &&
    failureReason(save.error) === "duplicate_category";

  const submit = () => {
    setAttempted(true);
    if (invalid) return;
    save.mutate({
      id: record?.id,
      kind,
      name: name.trim(),
      icon,
      color,
      severity: needsSeverity && severity !== "" ? severity : null,
      sortOrder: order,
      isActive,
    });
  };

  const show = (message: string | null) => (attempted ? message : null);

  return (
    <form
      noValidate
      aria-label={
        record
          ? c("editTitle", { name: record.name })
          : c("newTitle", { kind: t(kind) })
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (!save.isPending) submit();
      }}
      className="flex flex-col gap-5 rounded-card bg-paper-2 p-4 md:p-5"
    >
      <h3 className="t-h3">
        {record
          ? c("editTitle", { name: record.name })
          : c("newTitle", { kind: t(kind) })}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          htmlFor={`${uid}-name`}
          label={t("name")}
          error={show(errors.name) ?? (duplicate ? c("duplicate") : null)}
        >
          <Input
            id={`${uid}-name`}
            value={name}
            maxLength={80}
            required
            autoFocus
            autoComplete="off"
            aria-invalid={Boolean(show(errors.name)) || duplicate}
            aria-describedby={
              show(errors.name) || duplicate ? `${uid}-name-error` : undefined
            }
            disabled={save.isPending}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field htmlFor={`${uid}-icon`} label={t("icon")}>
          <Select
            id={`${uid}-icon`}
            value={icon}
            disabled={save.isPending}
            onChange={(event) =>
              setIcon(ICONS.find((item) => item === event.target.value) ?? icon)
            }
          >
            {ICONS.map((item) => (
              <option key={item} value={item}>
                {t(item)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          htmlFor={`${uid}-hex`}
          label={t("color")}
          hint={c("hexHint")}
          error={show(errors.color)}
        >
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label={c("pickColor")}
              value={HEX.test(color) ? color.toLowerCase() : "#000000"}
              disabled={save.isPending}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              className="size-11 shrink-0 cursor-pointer rounded-input bg-card p-1 shadow-ring disabled:opacity-45"
            />
            <Input
              id={`${uid}-hex`}
              value={color}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              aria-label={c("hex")}
              aria-invalid={Boolean(show(errors.color))}
              aria-describedby={`${uid}-hex-${show(errors.color) ? "error" : "hint"}`}
              disabled={save.isPending}
              onChange={(event) => setColor(event.target.value.trim())}
              className="font-mono uppercase"
            />
          </div>
        </Field>

        {needsSeverity ? (
          <Field
            htmlFor={`${uid}-severity`}
            label={t("severity")}
            error={show(errors.severity)}
          >
            <Select
              id={`${uid}-severity`}
              value={severity}
              required
              aria-invalid={Boolean(show(errors.severity))}
              aria-describedby={
                show(errors.severity) ? `${uid}-severity-error` : undefined
              }
              disabled={save.isPending}
              onChange={(event) =>
                setSeverity(
                  SEVERITIES.find((item) => item === event.target.value) ?? "",
                )
              }
            >
              <option value="">{c("choose")}</option>
              {SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field
          htmlFor={`${uid}-order`}
          label={t("sortOrder")}
          hint={c("sortHint")}
          error={show(errors.sortOrder)}
        >
          <Input
            id={`${uid}-order`}
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            step={1}
            value={sortOrder}
            aria-invalid={Boolean(show(errors.sortOrder))}
            aria-describedby={`${uid}-order-${show(errors.sortOrder) ? "error" : "hint"}`}
            disabled={save.isPending}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </Field>
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={isActive}
          disabled={save.isPending}
          onChange={(event) => setIsActive(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="flex flex-col">
          <span className="text-[15px] font-medium text-ink">
            {t("active")}
          </span>
          <span className="t-small text-ink-2">{c("activeHint")}</span>
        </span>
      </label>

      {duplicate ? null : <InlineError error={save.error} />}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="max-sm:w-full"
          disabled={save.isPending}
        >
          {save.isPending ? c("saving") : t("save")}
        </Button>
        <Button
          size="lg"
          className="max-sm:w-full"
          disabled={save.isPending}
          onClick={onClose}
        >
          {common("cancel")}
        </Button>
      </div>
    </form>
  );
}

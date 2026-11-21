"use client";

import {
  type ApiInputs,
  type ApiOutputs,
  categoryIconNames,
} from "@ruta/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { InlineError } from "@/components/admin/error-panel";
import { FormField } from "@/components/admin/form-field";
import { useOutcome } from "@/components/admin/outcome";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { CATEGORY_ICONS } from "@/components/category/category-glyph";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api, orpc } from "@/lib/web/api";
import { failureKind, failureReason } from "@/lib/web/errors";

export type CategoryRecord = ApiOutputs["catalog"]["list"][number];
export type CategoryKind = CategoryRecord["kind"];
type SaveInput = Omit<ApiInputs["catalog"]["save"], "requestId">;
type Icon = SaveInput["icon"];
type Severity = NonNullable<SaveInput["severity"]>;

const SEVERITIES: readonly Severity[] = ["blocking", "partial", "minor"];
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Create or edit one category in a dialog.
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
  /** Called after a save and on cancel; the dialog returns focus to its opener. */
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
    categoryIconNames.find((item) => item === record?.icon) ?? "map-pin",
  );
  const [color, setColor] = useState(record?.color ?? "#121211");
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

  const listKey = orpc.catalog.list.queryOptions({ input: { kind } }).queryKey;
  const byOrder = (a: CategoryRecord, b: CategoryRecord) =>
    a.sortOrder - b.sortOrder;

  // An edit shows in the table behind the dialog while the request is out, and
  // is taken back if it fails; the dialog itself closes on the server's word,
  // since a duplicate name can only be told to the person still typing it.
  const save = useStaffMutation<
    SaveInput,
    { id: string },
    { previous: CategoryRecord[] | undefined }
  >((input) => api.catalog.save(input), {
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      if (input.id && previous) {
        queryClient.setQueryData(
          listKey,
          previous
            .map((item) =>
              item.id === input.id
                ? { ...item, ...input, severity: input.severity ?? null }
                : item,
            )
            .sort(byOrder),
        );
      }
      return { previous };
    },
    onSuccess: (result, input) => {
      if (!input.id) {
        queryClient.setQueryData(listKey, (list) =>
          list
            ? [
                ...list,
                {
                  ...input,
                  id: result.id,
                  severity: input.severity ?? null,
                  createdAt: new Date(),
                },
              ].sort(byOrder)
            : list,
        );
      }
      announce(t("saved"));
      onClose();
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.catalog.key() });
    },
  });

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
  const nameError = show(errors.name) ?? (duplicate ? c("duplicate") : null);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // A save in flight keeps its dialog so its failure can still be shown.
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? record.name : t("newCategory")}</DialogTitle>
          <DialogDescription>{t(kind)}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) submit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor={`${uid}-name`}
              label={t("name")}
              error={nameError}
              className="sm:col-span-2"
            >
              <Input
                id={`${uid}-name`}
                value={name}
                maxLength={80}
                required
                autoFocus
                autoComplete="off"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? `${uid}-name-error` : undefined}
                disabled={save.isPending}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField htmlFor={`${uid}-icon`} label={t("icon")}>
              <Select
                value={icon}
                disabled={save.isPending}
                onValueChange={(value) =>
                  setIcon(
                    categoryIconNames.find((item) => item === value) ?? icon,
                  )
                }
              >
                <SelectTrigger id={`${uid}-icon`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Sorted by the desk's word for the glyph, not its code id. */}
                  {categoryIconNames
                    .toSorted((a, b) =>
                      t(`iconNames.${a}`).localeCompare(
                        t(`iconNames.${b}`),
                        "es",
                      ),
                    )
                    .map((item) => {
                      const ItemIcon = CATEGORY_ICONS[item];
                      return (
                        <SelectItem key={item} value={item}>
                          <ItemIcon aria-hidden />
                          {t(`iconNames.${item}`)}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              htmlFor={`${uid}-hex`}
              label={t("color")}
              error={show(errors.color)}
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={c("pickColor")}
                  value={HEX.test(color) ? color.toLowerCase() : "#000000"}
                  disabled={save.isPending}
                  onChange={(event) =>
                    setColor(event.target.value.toUpperCase())
                  }
                  className="size-9 shrink-0 cursor-pointer rounded-(--radius-field) border border-input bg-(--field-background) p-1 shadow-(--shadow-control) focus-visible:border-ring focus-visible:ring-[1.5px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Input
                  id={`${uid}-hex`}
                  value={color}
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={c("hex")}
                  aria-invalid={Boolean(show(errors.color))}
                  aria-describedby={
                    show(errors.color) ? `${uid}-hex-error` : undefined
                  }
                  disabled={save.isPending}
                  onChange={(event) => setColor(event.target.value.trim())}
                  className="tabular-nums"
                />
              </div>
            </FormField>

            <FormField
              htmlFor={`${uid}-order`}
              label={t("sortOrder")}
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
                aria-describedby={
                  show(errors.sortOrder) ? `${uid}-order-error` : undefined
                }
                disabled={save.isPending}
                onChange={(event) => setSortOrder(event.target.value)}
                className="tabular-nums"
              />
            </FormField>

            {needsSeverity ? (
              <FormField
                htmlFor={`${uid}-severity`}
                label={t("severity")}
                error={show(errors.severity)}
              >
                <Select
                  value={severity}
                  required
                  disabled={save.isPending}
                  onValueChange={(value) =>
                    setSeverity(SEVERITIES.find((item) => item === value) ?? "")
                  }
                >
                  <SelectTrigger
                    id={`${uid}-severity`}
                    className="w-full"
                    aria-invalid={Boolean(show(errors.severity))}
                    aria-describedby={
                      show(errors.severity)
                        ? `${uid}-severity-error`
                        : undefined
                    }
                  >
                    <SelectValue placeholder={c("choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}

            <div
              className={cn(
                "flex h-9 items-center justify-between gap-4",
                needsSeverity ? "sm:col-span-2" : "sm:mt-6.5",
              )}
            >
              <Label htmlFor={`${uid}-active`}>{t("active")}</Label>
              <Switch
                id={`${uid}-active`}
                checked={isActive}
                disabled={save.isPending}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {duplicate ? null : <InlineError error={save.error} />}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={save.isPending}
              onClick={onClose}
            >
              {common("cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? c("saving") : common("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

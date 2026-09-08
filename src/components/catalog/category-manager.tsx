"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/map/category-icons";
import { orpc } from "@/lib/orpc";
import { uuid } from "@/lib/uuid";
import {
  categoryKinds,
  editableCategory,
  saveCategoryInput,
} from "@/modules/catalog/contracts";

export function CategoryManager() {
  const t = useTranslations("catalog");
  const queryClient = useQueryClient();
  const [kind, setKind] =
    useState<(typeof categoryKinds.options)[number]>("consultation");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [search, setSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const query = useQuery(orpc.catalog.list.queryOptions({ input: { kind } }));
  const editing = query.data?.find((row) => row.id === editingId);
  const matching = query.data?.filter((row) =>
    row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  function openEditor(id: string | null) {
    setEditingId(id);
    setFormVersion((version) => version + 1);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "start" });
      nameRef.current?.focus({ preventScroll: true });
    });
  }
  const mutation = useMutation({
    ...orpc.catalog.save.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("saved"));
      setEditingId(null);
      setFormVersion((version) => version + 1);
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error(t("failed")),
  });
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        className="-ml-2 h-11"
        nativeButton={false}
        render={<Link href="/moderacion" />}
        role="link"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("intro")}
          </p>
        </div>
        <Button className="h-11" onClick={() => openEditor(null)}>
          <Plus className="size-4" aria-hidden />
          {t("create")}
        </Button>
      </header>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="category-kind">{t("kind")}</Label>
        <NativeSelect
          id="category-kind"
          size="lg"
          value={kind}
          aria-label={t("kind")}
          onChange={(event) => {
            setKind(categoryKinds.parse(event.target.value));
            setEditingId(null);
            setSearch("");
          }}
        >
          {categoryKinds.options.map((value) => (
            <option key={value} value={value}>
              {t(`kinds.${value}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section
          className="surface-card overflow-hidden"
          aria-labelledby="category-list-heading"
        >
          <div className="space-y-4 border-b p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="category-list-heading" className="font-medium">
                {t("list")}
              </h2>
              {matching && (
                <p className="text-xs text-muted-foreground" role="status">
                  {t("count", { count: matching.length })}
                </p>
              )}
            </div>
            <InputGroup className="h-11">
              <InputGroupAddon>
                <Search className="size-4" aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder={t("search")}
                aria-label={t("search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </InputGroup>
          </div>
          <ScrollArea
            key={`${kind}-${search}`}
            className="h-[min(52dvh,30rem)] min-h-60 [&_[data-slot=scroll-area-viewport]]:overscroll-contain"
          >
            {query.isPending && (
              <p className="p-5 text-sm text-muted-foreground" role="status">
                {t("loading")}
              </p>
            )}
            {query.isError && (
              <p className="p-5 text-sm text-destructive" role="alert">
                {t("failed")}
              </p>
            )}
            {matching?.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">
                {t(query.data?.length === 0 ? "empty" : "noResults")}
              </p>
            )}
            <ul className="divide-y px-4 sm:px-5">
              {matching?.map((row) => {
                const Icon = categoryIcon(row.icon);
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 py-4 data-selected:bg-accent/60"
                    data-selected={editingId === row.id ? "" : undefined}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{row.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t(row.isActive ? "active" : "inactive")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="h-11 shrink-0"
                      aria-label={t("editNamed", { name: row.name })}
                      onClick={() => openEditor(row.id)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      {t("edit")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </section>
        <form
          ref={formRef}
          aria-labelledby="category-form-heading"
          key={`${kind}-${editingId}-${formVersion}`}
          className="surface-card scroll-mt-24 space-y-5 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const parsed = saveCategoryInput.safeParse({
              requestId: uuid(),
              id: editingId ?? undefined,
              kind,
              name: form.get("name"),
              icon: form.get("icon"),
              color: form.get("color"),
              sortOrder: Number(form.get("sortOrder")),
              isActive: form.get("isActive") === "true",
              severity: kind === "traffic" ? form.get("severity") : null,
            });
            if (!parsed.success) {
              toast.error(t("invalid"));
              return;
            }
            mutation.mutate(parsed.data);
          }}
        >
          <h2 id="category-form-heading" className="text-xl font-medium">
            {t(editing ? "editTitle" : "create")}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="category-name">{t("name")}</Label>
            <Input
              ref={nameRef}
              id="category-name"
              name="name"
              className="h-11"
              required
              minLength={2}
              maxLength={80}
              defaultValue={editing?.name}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-icon">{t("icon")}</Label>
              <NativeSelect
                id="category-icon"
                name="icon"
                size="lg"
                defaultValue={
                  editing &&
                  editableCategory.shape.icon.safeParse(editing.icon).success
                    ? editing.icon
                    : "map-pin"
                }
              >
                {editableCategory.shape.icon.options.map((value) => (
                  <option key={value} value={value}>
                    {t(`icons.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-color">{t("color")}</Label>
              <Input
                id="category-color"
                name="color"
                type="color"
                className="h-11"
                defaultValue={editing?.color ?? "#166534"}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-order">{t("order")}</Label>
              <Input
                id="category-order"
                name="sortOrder"
                type="number"
                min={0}
                max={1000}
                defaultValue={editing?.sortOrder ?? 0}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-active">{t("state")}</Label>
              <NativeSelect
                id="category-active"
                name="isActive"
                size="lg"
                defaultValue={String(editing?.isActive ?? true)}
              >
                <option value="true">{t("active")}</option>
                <option value="false">{t("inactive")}</option>
              </NativeSelect>
            </div>
          </div>
          {kind === "traffic" && (
            <div className="space-y-2">
              <Label htmlFor="category-severity">{t("severity")}</Label>
              <NativeSelect
                id="category-severity"
                name="severity"
                size="lg"
                defaultValue={editing?.severity ?? "minor"}
              >
                {["blocking", "partial", "minor"].map((value) => (
                  <option key={value} value={value}>
                    {t(`severityOptions.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{t("deactivateHint")}</p>
          <div className="flex gap-3">
            <Button
              type="submit"
              className="h-11"
              disabled={mutation.isPending}
            >
              {t("save")}
            </Button>
            {editing && (
              <Button
                variant="ghost"
                className="h-11"
                onClick={() => setEditingId(null)}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

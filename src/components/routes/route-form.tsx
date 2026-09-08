"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PathPicker } from "@/components/map/path-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc";
import { uuid } from "@/lib/uuid";
import {
  difficulty,
  routeServices,
  submitRouteInput,
} from "@/modules/routes/contracts";

export function RouteForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("routes");
  const [points, setPoints] = useState<{ lng: number; lat: number }[]>([]);
  const [requestId] = useState(() => uuid());
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const categories = useQuery(orpc.routes.categories.queryOptions());
  const submit = useMutation({
    ...orpc.routes.submit.mutationOptions(),
    onSuccess: async () => {
      toast.success(t("sent"));
      await queryClient.invalidateQueries({
        queryKey: orpc.routes.browse.key(),
      });
      onDone();
    },
    onError: () => setError(t("failed")),
  });
  return (
    <form
      className="surface-card space-y-6 p-5 md:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = submitRouteInput.safeParse({
          requestId,
          name: form.get("name"),
          description: form.get("description"),
          categoryId: form.get("categoryId"),
          difficulty: form.get("difficulty"),
          durationMinutes: Number(form.get("duration")),
          path: points,
          services: form.getAll("services"),
        });
        if (!parsed.success) {
          setError(t("invalid"));
          return;
        }
        setError(null);
        submit.mutate(parsed.data);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("create")}</h2>
        <Button variant="ghost" onClick={onDone} disabled={submit.isPending}>
          {t("cancel")}
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="route-name">{t("name")}</Label>
          <Input
            id="route-name"
            name="name"
            minLength={5}
            maxLength={120}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="route-category">{t("category")}</Label>
          <NativeSelect
            id="route-category"
            name="categoryId"
            size="lg"
            required
            defaultValue=""
          >
            <option value="" disabled>
              {t("choose")}
            </option>
            {categories.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="route-difficulty">{t("difficultyLabel")}</Label>
          <NativeSelect id="route-difficulty" name="difficulty" size="lg">
            {difficulty.options.map((value) => (
              <option key={value} value={value}>
                {t(`difficulty.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="route-duration">{t("durationLabel")}</Label>
          <Input
            id="route-duration"
            name="duration"
            type="number"
            min={5}
            max={10080}
            required
            className="h-11"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="route-description">{t("description")}</Label>
        <Textarea
          id="route-description"
          name="description"
          minLength={40}
          maxLength={3000}
          required
          rows={4}
        />
      </div>
      <fieldset>
        <legend className="mb-2 font-medium text-sm">
          {t("servicesLabel")}
        </legend>
        <div className="flex flex-wrap gap-3">
          {routeServices.options.map((value) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm"
            >
              <input
                type="checkbox"
                name="services"
                value={value}
                className="size-4 accent-primary"
              />
              {t(`services.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <PathPicker points={points} onChange={setPoints} />
      <p className="text-sm text-muted-foreground">{t("reviewHint")}</p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="h-11"
        disabled={submit.isPending || categories.isPending || points.length < 2}
      >
        {t(submit.isPending ? "sending" : "submit")}
      </Button>
    </form>
  );
}

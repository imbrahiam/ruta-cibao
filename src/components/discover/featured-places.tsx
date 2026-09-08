"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { PlaceCard } from "./place-card";

export function FeaturedPlaces() {
  const t = useTranslations("discover");
  const query = useQuery(
    orpc.places.browse.queryOptions({ input: { limit: 3 } }),
  );
  if (query.isPending)
    return (
      <p
        role="status"
        className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Spinner className="size-4" />
        {t("loading")}
      </p>
    );
  if (query.isError)
    return (
      <div className="surface-card p-8 text-center">
        <p className="mb-4 text-sm text-muted-foreground" role="alert">
          {t("error")}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  if (query.data.total === 0)
    return (
      <p className="surface-card p-8 text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {query.data.items.map((place) => (
        <PlaceCard key={place.id} place={place} />
      ))}
    </div>
  );
}

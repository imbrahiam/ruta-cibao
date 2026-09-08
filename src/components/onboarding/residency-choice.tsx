"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Compass, IdCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { TierCard } from "@/components/onboarding/tier-card";
import { BlurFade } from "@/components/ui/blur-fade";
import { useRouter } from "@/i18n/navigation";
import { client, orpc } from "@/lib/orpc";

/**
 * The fork: does this person live here, or are they passing through?
 *
 * Asked once, right after the account exists, because it is the only moment
 * where the answer costs nothing and buys everything. A resident gets sent to
 * the cédula check, which is what unlocks voting and pinning a place from where
 * they are standing. A visitor gets sent straight on and is never asked again —
 * the platform is supposed to work for a tourist too.
 *
 * Both answers write the same timestamp. Saying "I live here" is not a claim
 * the platform believes; only the civil registry settles that.
 */
export function ResidencyChoice({ next }: { next: string }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function answer(resident: boolean, destination: string) {
    startTransition(async () => {
      setError(false);
      try {
        await client.me.declareResidency({ resident });
        await queryClient.invalidateQueries({
          queryKey: orpc.me.get.queryOptions().queryKey,
        });
        router.replace(destination);
        router.refresh();
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <BlurFade delay={0.12}>
        <TierCard
          onSelect={() =>
            answer(true, `/verificar?next=${encodeURIComponent(next)}`)
          }
          disabled={pending}
          icon={<IdCard className="size-6" aria-hidden />}
          title={t("citizen.title")}
          description={t("citizen.description")}
          action={t("citizen.action")}
          highlighted
        />
      </BlurFade>

      <BlurFade delay={0.18}>
        <TierCard
          onSelect={() => answer(false, next)}
          disabled={pending}
          icon={<Compass className="size-6" aria-hidden />}
          title={t("visitor.title")}
          description={t("visitor.description")}
          action={t("visitor.action")}
        />
      </BlurFade>
      {pending && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {t("saving")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {t("saveError")}
        </p>
      )}
    </div>
  );
}

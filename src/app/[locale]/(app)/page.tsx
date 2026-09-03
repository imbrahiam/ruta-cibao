import { Map as MapIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function Home() {
  const t = await getTranslations("home");
  const app = await getTranslations("app");

  return (
    <BlurFade delay={0.05} inView>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-semibold text-3xl tracking-tight">
            {app("name")}
          </h1>
          <p className="max-w-prose text-balance text-muted-foreground">
            {t("intro")}
          </p>
        </div>

        {/* The map is the product. It gets the primary action, at a size that
            works with a thumb, above everything else. */}
        <Button
          size="lg"
          className="h-12 w-full text-base sm:w-auto sm:self-start"
          nativeButton={false}
          render={<Link href="/mapa" prefetch />}
        >
          <MapIcon className="size-5" aria-hidden />
          {t("openMap")}
        </Button>

        <a
          className="text-muted-foreground text-sm underline underline-offset-4"
          href="/api/docs"
        >
          {t("apiDocs")}
        </a>
      </div>
    </BlurFade>
  );
}

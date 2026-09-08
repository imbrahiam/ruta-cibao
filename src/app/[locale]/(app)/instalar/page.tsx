import { ArrowRight, CloudOff, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { InstallApp } from "@/components/offline/install-app";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("install");
  return { title: t("action") };
}

export default async function InstallPage() {
  const t = await getTranslations("install");
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mx-auto mb-10 max-w-xl text-center">
        <p className="mb-4 text-xs font-medium text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
          {t("intro")}
        </p>
      </header>
      <InstallApp />
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {(["ios", "other"] as const).map((kind) => (
          <section key={kind} className="surface-card p-6">
            <h2 className="mb-5 font-medium">{t(`${kind}Title`)}</h2>
            <ol className="space-y-4">
              {([1, 2, 3] as const).map((step) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-primary">
                    {step}
                  </span>
                  {t(`${kind}Step${step}`)}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <div className="my-10 grid gap-8 sm:grid-cols-2">
        {(
          [
            { key: "offline", icon: CloudOff },
            { key: "private", icon: ShieldCheck },
          ] as const
        ).map(({ key, icon: Icon }) => (
          <section key={key}>
            <Icon className="mb-3 size-5 text-primary" aria-hidden />
            <h2 className="font-medium">{t(`${key}Title`)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(`${key}Body`)}
            </p>
          </section>
        ))}
      </div>
      <div className="text-center">
        <Button
          nativeButton={false}
          render={<Link href="/explorar" />}
          className="h-11 rounded-full px-6"
        >
          {t("back")}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

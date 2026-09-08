import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-4 text-xs font-medium text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        {t("intro")}
      </p>
      <div className="my-10 space-y-8">
        {(
          ["identity", "account", "location", "device", "providers"] as const
        ).map((key) => (
          <section key={key}>
            <h2 className="text-lg font-medium">{t(`${key}Title`)}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t(`${key}Body`)}
            </p>
          </section>
        ))}
      </div>
      <Link
        href="/explorar"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        {t("back")}
      </Link>
    </article>
  );
}

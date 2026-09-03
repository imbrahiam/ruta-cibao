import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const app = await getTranslations({ locale, namespace: "app" });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-3xl tracking-tight">{app("name")}</h1>
      <p className="text-balance text-muted-foreground">{t("intro")}</p>
      <a className="underline underline-offset-4" href="/api/docs">
        {t("apiDocs")}
      </a>
    </div>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const app = await getTranslations({ locale, namespace: "app" });

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="font-semibold text-3xl">{app("name")}</h1>
      <p className="text-balance opacity-80">{t("intro")}</p>
      <a className="underline underline-offset-4" href="/api/docs">
        {t("apiDocs")}
      </a>
    </main>
  );
}

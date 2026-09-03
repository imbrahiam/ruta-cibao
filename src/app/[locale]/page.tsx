import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("home");
  const app = useTranslations("app");

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

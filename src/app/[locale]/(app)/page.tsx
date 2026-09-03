import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");
  const app = await getTranslations("app");

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

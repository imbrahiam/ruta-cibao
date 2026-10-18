import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Placeholder } from "@/components/ui/loading";
import { env } from "@/lib/env";
import { canDeliverEmail } from "@/lib/mail";
import { canDeliverSms } from "@/lib/sms";
import { safeCallbackPath } from "@/modules/access/route-policy";
import { getServerViewer } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

async function SignIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const callbackURL = safeCallbackPath(
    (await searchParams).callbackUrl,
    "/mapa",
  );
  const viewer = await getServerViewer();
  if (viewer.kind !== "anonymous") redirect(callbackURL);

  return (
    <SignInForm
      callbackURL={callbackURL}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID)}
      methods={[
        ...(canDeliverSms() ? (["phone"] as const) : []),
        ...(canDeliverEmail() ? (["email"] as const) : []),
      ]}
    />
  );
}

export default async function SignInPage({
  searchParams,
}: PageProps<"/[locale]/entrar">) {
  const t = await getTranslations("auth");
  return (
    <div className="stagger flex flex-col gap-8">
      <header>
        <p className="t-label text-ink-3">{t("eyebrow")}</p>
        <h1 className="t-h2 mt-3 text-ink">{t("title")}</h1>
        <p className="t-body-lg mt-3 text-ink-2">{t("lede")}</p>
      </header>
      <Suspense fallback={<Placeholder className="h-64 rounded-panel" />}>
        <SignIn searchParams={searchParams} />
      </Suspense>
      <p className="t-small text-ink-3">{t("terms")}</p>
    </div>
  );
}

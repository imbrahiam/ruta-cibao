import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignInForm } from "@/components/onboarding/sign-in-form";
import { BlurFade } from "@/components/ui/blur-fade";
import { Spinner } from "@/components/ui/spinner";
import { env } from "@/lib/env";
import { canDeliverEmail } from "@/lib/mail";
import { canDeliverSms } from "@/lib/sms";
import { safeCallbackPath } from "@/modules/access/route-policy";
import { getServerViewer } from "@/modules/access/server";

async function SignInContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const callbackURL = safeCallbackPath((await searchParams).callbackUrl);
  const viewer = await getServerViewer();
  if (viewer.kind !== "anonymous") redirect(callbackURL);

  const t = await getTranslations("auth");

  return (
    <>
      <BlurFade delay={0.05} inView>
        <h1 className="page-title">{t("signIn")}</h1>
      </BlurFade>

      <BlurFade delay={0.1} inView>
        <SignInForm
          callbackURL={callbackURL}
          googleEnabled={Boolean(env.GOOGLE_CLIENT_ID)}
          methods={[
            ...(canDeliverSms() ? (["phone"] as const) : []),
            ...(canDeliverEmail() ? (["email"] as const) : []),
          ]}
        />
      </BlurFade>
    </>
  );
}

async function SignInFallback() {
  const t = await getTranslations("auth");
  return (
    <p
      className="flex items-center justify-center gap-2 text-muted-foreground text-sm"
      role="status"
    >
      <Spinner className="size-4" /> {t("checkingSession")}
    </p>
  );
}

export default function SignInPage({
  searchParams,
}: PageProps<"/[locale]/entrar">) {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}

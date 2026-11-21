import { inviteCode } from "@ruta/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreButtons } from "@/components/landing/store-buttons";
import { CopyLink } from "@/components/share/copy-link";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";
import { lookupInvite } from "@/modules/reputation/service";

type Params = Promise<{ code: string }>;

/** The inviter's name for a well-formed, existing code; null otherwise. */
async function inviter(
  raw: string,
): Promise<{ code: string; name: string } | null> {
  const parsed = inviteCode.safeParse(raw);
  if (!parsed.success) return null;
  try {
    const { inviterName } = await lookupInvite(parsed.data);
    return { code: parsed.data, name: inviterName };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const found = await inviter((await params).code);
  const t = getT("share");
  return {
    title: found
      ? t("invite.title", { name: found.name })
      : t("unavailableTitle"),
    // An invite is for the person it was sent to, not for search.
    robots: { index: false, follow: false },
  };
}

/** Where a shared invite link lands: who invited you, and the code to type. */
export default async function InvitePage({ params }: { params: Params }) {
  const found = await inviter((await params).code);
  if (!found) notFound();
  const t = getT("share");
  const landing = getT("landing");

  return (
    <div className="container-page py-12 md:py-20">
      <div className="flex max-w-xl flex-col">
        <h1 className="t-h2 font-[family-name:var(--font-fraunces)] text-balance">
          {t("invite.title", { name: found.name })}
        </h1>
        <p className="t-body-lg mt-4 text-pretty text-ink-2">
          {t("invite.body")}
        </p>

        <div className="mt-8 flex flex-col items-start gap-1">
          <p className="t-small text-ink-2">{t("invite.codeLabel")}</p>
          <p className="font-mono text-[34px] font-semibold tracking-[0.18em] text-brand">
            {found.code}
          </p>
          <CopyLink
            value={found.code}
            labels={{
              copy: t("invite.copyCode"),
              copied: t("invite.codeCopied"),
              failed: t("copyFailed"),
            }}
          />
        </div>

        <div className="mt-10">
          <StoreButtons
            iosUrl={site.iosUrl}
            androidUrl={site.androidUrl}
            labels={{
              ios: landing("ios"),
              android: landing("android"),
              iosSoon: landing("iosSoon"),
              androidSoon: landing("androidSoon"),
            }}
          />
        </div>
      </div>
    </div>
  );
}

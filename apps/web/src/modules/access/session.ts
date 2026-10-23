import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberProfiles } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { isDeliverableAddress } from "@/lib/mail";
import { toViewer, type Viewer } from "./viewer";

/** The verified ways to reach the signed-in account, as only it may see them. */
export type AccountContact = {
  phoneNumber: string | null;
  phoneVerified: boolean;
  /** Null for phone-only accounts: their internal placeholder never leaves. */
  email: string | null;
  emailVerified: boolean;
};

export type ResolvedSession =
  | { viewer: Viewer & { kind: "anonymous" }; contact: null }
  | { viewer: Viewer; contact: AccountContact };

/**
 * Resolves the Better Auth session behind a request into a viewer.
 *
 * Contact verification is read from the account itself, so it cannot be
 * claimed by anything the caller sends.
 */
export async function resolveSession(
  headers: Headers,
): Promise<ResolvedSession> {
  const session = await getAuth().api.getSession({ headers });
  if (!session?.user) return { viewer: { kind: "anonymous" }, contact: null };

  const account = session.user;
  // The phone-only placeholder (and any other non-deliverable stand-in) is
  // not an address: it is neither shown nor counted as a verified contact.
  const email = isDeliverableAddress(account.email) ? account.email : null;
  const contact: AccountContact = {
    phoneNumber: account.phoneNumber ?? null,
    phoneVerified: Boolean(account.phoneNumber && account.phoneNumberVerified),
    email,
    emailVerified: Boolean(email && account.emailVerified),
  };

  const [profile] = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, account.id))
    .limit(1);

  const viewer = toViewer(account.id, profile, {
    image: account.image ?? null,
    contactVerified: contact.phoneVerified || contact.emailVerified,
  });
  if (viewer.kind === "anonymous") return { viewer, contact: null };
  return { viewer, contact };
}

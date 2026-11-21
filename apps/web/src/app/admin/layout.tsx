import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AdminProviders } from "@/components/admin/providers";
import { AdminShell } from "@/components/admin/shell";
import { AdminThemeScope } from "@/components/admin/theme-scope";
import { canDeliverSms, isDemoPhoneSignInEnabled } from "@/lib/sms";
import { ADMIN_THEME_SCRIPT } from "@/lib/web/admin-theme-script";
import { getT, pickMessages } from "@/lib/web/i18n";

const t = getT("admin");

// The browser toolbar takes the desk's surface (white, or the dark desk), not
// the public site's warm paper.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111112" },
  ],
};

export const metadata: Metadata = {
  // Restated here: a segment that sets its own title stops inheriting the root template.
  title: { default: t("title"), template: `%s | ${t("brand")}` },
  // The staff desk is never an entry point for search engines.
  robots: { index: false, follow: false },
};

/**
 * `AdminShell` withholds `{children}` until `me.get` confirms a staff session
 * on the client, so child page segments do not render in the unauthenticated
 * prerender shell.
 */
export const instant = false;

/**
 * The staff area. Everything beneath is client-rendered behind the session
 * gate; the catalogue slice below is all the browser downloads of the text.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminProviders
      messages={pickMessages([
        "admin",
        "common",
        "reports",
        "time",
        "consultations",
      ])}
    >
      {/* Before the desk paints: the viewer's theme, so dark never flashes white. */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string from our own module, no user input
        dangerouslySetInnerHTML={{ __html: ADMIN_THEME_SCRIPT }}
      />
      <AdminThemeScope>
        <Suspense>
          <AdminShell
            phoneSignInEnabled={canDeliverSms() || isDemoPhoneSignInEnabled()}
          >
            {children}
          </AdminShell>
        </Suspense>
      </AdminThemeScope>
    </AdminProviders>
  );
}

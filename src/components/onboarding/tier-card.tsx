"use client";

import { ArrowRight } from "lucide-react";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard } from "@/components/ui/magic-card";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";

/**
 * Shows that the tap registered, without a skeleton.
 *
 * `useLinkStatus` reports the pending state of the enclosing <Link>. Because
 * the destination is prefetched it is normally instant and this never appears;
 * on a slow connection — the reason this app exists — the arrow becomes a
 * spinner in place, with no layout shift and nothing to re-read.
 */
function TapFeedback() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Spinner className="size-5" />
  ) : (
    <ArrowRight className="size-5" aria-hidden />
  );
}

export function TierCard({
  href,
  icon,
  title,
  description,
  action,
  highlighted = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={href}
      // 88px floor: comfortably past the 44px WCAG 2.2 target, because this is
      // tapped one-handed, outdoors, by people who have never seen the app.
      className="group relative block min-h-[88px] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <MagicCard
        className="rounded-xl p-5"
        gradientOpacity={highlighted ? 0.5 : 0.25}
      >
        <div className="flex items-start gap-4">
          <span className="mt-0.5 shrink-0 text-foreground/70">{icon}</span>

          <span className="flex-1">
            <span className="block font-medium text-base">{title}</span>
            <span className="mt-1 block text-muted-foreground text-sm leading-relaxed">
              {description}
            </span>
            <span className="mt-3 flex items-center gap-1.5 font-medium text-sm">
              {action}
            </span>
          </span>

          <span className="mt-0.5 shrink-0 text-muted-foreground">
            <TapFeedback />
          </span>
        </div>
      </MagicCard>

      {/* Marks the recommended path. Decorative only — the copy already says
          what each choice means, so nothing is lost with motion turned off. */}
      {highlighted && (
        <BorderBeam duration={8} size={80} className="motion-reduce:hidden" />
      )}
    </Link>
  );
}

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

/**
 * The card's inside, so the outside can be a link or a button.
 *
 * Choosing "I live here" has to be recorded before the navigation happens, and
 * an anchor that has to run an await first is a link that lies about where it
 * goes — so that variant is a real button.
 */
function CardBody({
  icon,
  title,
  description,
  action,
  pendingIndicator,
  highlighted,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  pendingIndicator: ReactNode;
  highlighted: boolean;
}) {
  return (
    <>
      {/*
        No hover gradient. The cursor-following wash read as a smudge across the
        text, and on a phone — where this card is actually used — there is no
        cursor for it to follow, so it was cost without benefit. The border
        trace stays, retinted from the registry's purple and pink to the
        project's green.
      */}
      <MagicCard
        className="rounded-xl p-5 transition-colors group-hover:bg-secondary"
        gradientOpacity={0}
        gradientFrom="#166534"
        gradientTo="#4ade80"
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
            {pendingIndicator}
          </span>
        </div>
      </MagicCard>

      {/* Marks the recommended path. Decorative only — the copy already says
          what each choice means, so nothing is lost with motion turned off. */}
      {highlighted && (
        <BorderBeam duration={8} size={80} className="motion-reduce:hidden" />
      )}
    </>
  );
}

// 88px floor: comfortably past the 44px WCAG 2.2 target, because this is
// tapped one-handed, outdoors, by people who have never seen the app.
const CARD_CLASS =
  "group relative block min-h-[88px] w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function TierCard({
  href,
  onSelect,
  icon,
  title,
  description,
  action,
  highlighted = false,
  disabled = false,
}: {
  /** A destination, or `onSelect` when the choice has to be recorded first. */
  href?: string;
  onSelect?: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  highlighted?: boolean;
  disabled?: boolean;
}) {
  if (href) {
    return (
      <Link href={href} className={CARD_CLASS}>
        <CardBody
          icon={icon}
          title={title}
          description={description}
          action={action}
          pendingIndicator={<TapFeedback />}
          highlighted={highlighted}
        />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`${CARD_CLASS} disabled:pointer-events-none disabled:opacity-60`}
    >
      <CardBody
        icon={icon}
        title={title}
        description={description}
        action={action}
        pendingIndicator={<ArrowRight className="size-5" aria-hidden />}
        highlighted={highlighted}
      />
    </button>
  );
}

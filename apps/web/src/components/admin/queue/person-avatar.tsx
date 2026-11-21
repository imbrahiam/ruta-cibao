"use client";

import { Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Two letters for an avatar with no picture: "Leonel Santos" → "LS". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A person's photo, or their initials; an identity mark beside their name.
 *
 * A verified resident wears a small seal on the avatar's corner, the way the
 * apps show it, instead of words beside the name. The seal is announced and
 * has a tooltip; the avatar itself stays decorative.
 */
export function PersonAvatar({
  name,
  image,
  className,
  verified,
}: {
  name: string | null;
  image: string | null;
  className?: string;
  /** The words for the seal ("Residente verificado"); no seal when omitted. */
  verified?: string;
}) {
  const avatar = (
    <Avatar aria-hidden className={cn("size-6", className)}>
      {image ? (
        <AvatarImage src={image} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-card text-[10px] font-medium text-muted-foreground ring-1 ring-border ring-inset">
        {name ? initials(name) : "?"}
      </AvatarFallback>
    </Avatar>
  );
  if (!verified) return avatar;
  return (
    <span className="relative inline-flex shrink-0">
      {avatar}
      <span
        role="img"
        aria-label={verified}
        title={verified}
        // Scales with the avatar (a corner, not a cover), never below 12 px.
        className="absolute -right-1 -bottom-1 flex aspect-square w-[42%] min-w-3 items-center justify-center rounded-full bg-primary text-primary-foreground ring-[1.5px] ring-background"
      >
        <Check aria-hidden strokeWidth={4} className="size-[65%]" />
      </span>
    </span>
  );
}

"use client";

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

/** A person's photo, or their initials; an identity mark beside their name. */
export function PersonAvatar({
  name,
  image,
  className,
}: {
  name: string | null;
  image: string | null;
  className?: string;
}) {
  return (
    <Avatar aria-hidden className={cn("size-6", className)}>
      {image ? (
        <AvatarImage src={image} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
        {name ? initials(name) : "?"}
      </AvatarFallback>
    </Avatar>
  );
}

"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** A dropdown of actions. The trigger is rendered by the caller's element. */
export function Menu({
  trigger,
  children,
  align = "end",
  side = "bottom",
}: {
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
}) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          className="z-50 outline-none"
          sideOffset={8}
          align={align}
          side={side}
        >
          <BaseMenu.Popup className="min-w-56 origin-[var(--transform-origin)] rounded-card bg-card p-1.5 text-ink shadow-lg outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0">
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

const ITEM =
  "flex min-h-10 w-full cursor-default select-none items-center gap-3 rounded-[10px] px-3 text-[15px] text-ink outline-none data-[highlighted]:bg-paper-2 pointer-coarse:min-h-11 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-ink-2";

export function MenuItem({
  className,
  tone,
  ...props
}: ComponentProps<typeof BaseMenu.Item> & { tone?: "danger" }) {
  return (
    <BaseMenu.Item
      className={cx(
        ITEM,
        tone === "danger" && "text-danger [&_svg]:text-danger",
        className as string,
      )}
      {...props}
    />
  );
}

export function MenuLinkItem({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.LinkItem>) {
  return (
    <BaseMenu.LinkItem className={cx(ITEM, className as string)} {...props} />
  );
}

export function MenuSeparator() {
  return <BaseMenu.Separator className="mx-2 my-1.5 h-px bg-line/70" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <BaseMenu.Group>
      <BaseMenu.GroupLabel className="t-label px-3 pt-2 pb-1.5 text-ink-3">
        {children}
      </BaseMenu.GroupLabel>
    </BaseMenu.Group>
  );
}

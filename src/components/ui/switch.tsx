"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentProps } from "react";

export function Switch(props: ComponentProps<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root
      className="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-paper-3 p-0.5 shadow-ring transition-colors duration-200 data-[checked]:bg-accent data-[disabled]:opacity-45"
      {...props}
    >
      <BaseSwitch.Thumb className="size-5 rounded-full bg-card shadow-sm transition-transform duration-200 ease-out data-[checked]:translate-x-4" />
    </BaseSwitch.Root>
  );
}

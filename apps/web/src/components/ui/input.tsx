import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  onWheel,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      // Local change from shadcn: a focused number input steps its value on
      // mouse wheel, so scrolling the page over a price silently turned
      // 3,500 into 3,500.01 (step 0.01). Leaving focus lets the page scroll
      // and keeps the value; arrow keys still step on purpose.
      onWheel={(event) => {
        if (type === "number" && event.currentTarget === document.activeElement)
          event.currentTarget.blur();
        onWheel?.(event);
      }}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-(--radius-field) border bg-(--field-background) px-3 py-1 text-base shadow-(--shadow-control) transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[1.5px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

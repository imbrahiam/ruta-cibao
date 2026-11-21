"use client";

import { QrCode } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { buttonStyles } from "@/components/site/button";
import { cx } from "@/lib/web/cx";

/**
 * The link's actions in one row, with the code opening underneath it, so
 * revealing the code never moves the buttons. `panel` only exists on narrow
 * screens; a desktop shows the code in view and leaves it out.
 */
export function ShareRow({
  copy,
  label,
  panel,
}: {
  copy: ReactNode;
  label: string;
  panel?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-1">
        {copy}
        {panel ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((value) => !value)}
            className={cx(buttonStyles({ variant: "ghost" }), "md:hidden")}
          >
            <QrCode aria-hidden />
            {label}
          </button>
        ) : null}
      </div>
      {panel ? (
        <div id={id} hidden={!open} className="mt-2 md:hidden">
          {panel}
        </div>
      ) : null}
    </>
  );
}

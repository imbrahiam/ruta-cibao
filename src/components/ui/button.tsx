import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:opacity-90",
  accent: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-card text-ink shadow-ring hover:bg-paper-2",
  ghost: "text-ink-2 hover:bg-paper-3 hover:text-ink",
  danger: "bg-card text-danger-ink shadow-ring hover:bg-paper-2",
};

/*
 * Genesis pads a button 9px 16px 10px: one extra pixel underneath centres the
 * x-height optically. The fixed heights below keep that rhythm while lining
 * buttons up with inputs, and the coarse-pointer floor keeps every target at
 * 44px on a phone.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 pb-px text-[14px] pointer-coarse:min-h-11",
  md: "h-10 gap-2 px-4 pb-px text-[15px] pointer-coarse:min-h-11",
  lg: "h-12 gap-2 px-5 pb-px text-[15px]",
};

export function buttonStyles({
  variant = "secondary",
  size = "md",
  block = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
} = {}) {
  return cx(
    "press inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-medium tracking-[-0.008em] disabled:opacity-45 data-[disabled]:opacity-45 [&_svg]:size-[18px] [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
  );
}

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & StyleProps) {
  return (
    <button
      type={type}
      className={cx(buttonStyles({ variant, size, block }), className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<typeof Link> & StyleProps) {
  return (
    <Link
      className={cx(buttonStyles({ variant, size, block }), className)}
      {...props}
    />
  );
}

/**
 * A round, icon-only control. The label is required: it is what a screen
 * reader says, and the tooltip-free map controls have nothing else.
 */
export function IconButton({
  label,
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  variant?: ButtonVariant | "glass";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        "press inline-flex shrink-0 items-center justify-center rounded-full disabled:opacity-45 [&_svg]:shrink-0",
        variant === "glass" ? "glass text-ink" : VARIANTS[variant],
        size === "sm" && "size-8 pointer-coarse:size-11 [&_svg]:size-4",
        size === "md" && "size-10 pointer-coarse:size-11 [&_svg]:size-[18px]",
        size === "lg" && "size-12 [&_svg]:size-5",
        className,
      )}
      {...props}
    />
  );
}

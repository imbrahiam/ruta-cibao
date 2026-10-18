"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { orpc } from "@/lib/orpc";

/**
 * Resident or visitor, asked once, right after the account exists. Both
 * answers stop the question; only the resident path asks for anything more,
 * and even that can wait.
 */
export function ResidencyChoice({ next }: { next: string }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const queryClient = useQueryClient();
  const declare = useMutation(
    orpc.me.declareResidency.mutationOptions({
      onSuccess: async (_, input) => {
        await queryClient.invalidateQueries({ queryKey: orpc.me.get.key() });
        router.replace(
          (input.resident
            ? `/verificar?next=${encodeURIComponent(next)}`
            : next) as "/mapa",
        );
      },
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <Choice
        icon={<BadgeCheck strokeWidth={1.5} />}
        title={t("citizen.title")}
        body={t("citizen.description")}
        action={t("citizen.action")}
        accent
        disabled={declare.isPending}
        onClick={() => declare.mutate({ resident: true })}
      />
      <Choice
        icon={<Compass strokeWidth={1.5} />}
        title={t("visitor.title")}
        body={t("visitor.description")}
        action={t("visitor.action")}
        disabled={declare.isPending}
        onClick={() => declare.mutate({ resident: false })}
      />
      {declare.isError ? (
        <p role="alert" className="t-small text-danger">
          {t("saveError")}
        </p>
      ) : null}
    </div>
  );
}

function Choice({
  icon,
  title,
  body,
  action,
  accent = false,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: string;
  accent?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="press group flex w-full items-start gap-4 rounded-panel bg-card p-5 text-left shadow-ring transition-shadow hover:shadow-md disabled:opacity-60"
    >
      <span
        className={cx(
          "flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
          accent ? "bg-accent-soft text-accent" : "bg-paper-3 text-ink-2",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-medium tracking-[-0.012em] text-ink">
          {title}
        </span>
        <span className="t-small mt-1 block text-ink-2">{body}</span>
        <span
          className={cx(
            "mt-3 inline-block text-[14px] font-medium",
            accent ? "text-accent" : "text-ink",
          )}
        >
          {action}
          <span
            aria-hidden
            className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
          >
            ›
          </span>
        </span>
      </span>
    </button>
  );
}

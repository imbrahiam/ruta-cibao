"use client";

import { formatPhone, normalizePhone } from "@ruta/shared/phone";
import { ChevronDown, Copy, Mail, Phone } from "lucide-react";
import { useRef } from "react";
import { useTranslations } from "use-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCopy } from "@/lib/web/use-copy";
import { useOutcome } from "../outcome";
import { WhatsAppMark } from "./whatsapp-mark";

/**
 * What the number is used for. It only decides the order and the icon: a
 * WhatsApp number leads with WhatsApp, a phone number with a call, and both
 * are always offered, because the desk cannot know which of the two a
 * business answers.
 */
export type ContactKind = "phone" | "whatsapp" | "email";

const ITEM = "pointer-coarse:min-h-11";

/**
 * A phone, WhatsApp or email value that does something: a quiet button that
 * opens a menu of the actions staff actually take (call, message, copy).
 * Numbers are shown the way they are written here (`809-555-0101`) and
 * linked in E.164; a value that is not a Dominican number only offers copy.
 */
export function ContactValue({
  kind,
  value,
  className,
}: {
  kind: ContactKind;
  value: string;
  className?: string;
}) {
  const t = useTranslations("admin.contactActions");
  const announce = useOutcome();
  const copy = useCopy();
  // Opened with a pointer: on close the menu does not hand focus back to the
  // trigger, which Safari would then draw a ring around. A keyboard user still
  // gets focus (and its ring) back where they were.
  const byPointer = useRef(false);

  const e164 = kind === "email" ? null : normalizePhone(value);
  const display = e164 ? formatPhone(e164) : value;
  const Icon =
    kind === "email" ? Mail : kind === "whatsapp" ? WhatsAppMark : Phone;

  const call = e164 ? (
    <DropdownMenuItem key="call" asChild className={ITEM}>
      <a href={`tel:${e164}`}>
        <Phone aria-hidden />
        {t("call")}
      </a>
    </DropdownMenuItem>
  ) : null;
  const whatsapp = e164 ? (
    <DropdownMenuItem key="whatsapp" asChild className={ITEM}>
      <a
        href={`https://wa.me/${e164.slice(1)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <WhatsAppMark />
        {t("whatsapp")}
        <span className="sr-only">{t("newTab")}</span>
      </a>
    </DropdownMenuItem>
  ) : null;
  const actions =
    kind === "email" ? (
      <DropdownMenuItem asChild className={ITEM}>
        <a href={`mailto:${value}`}>
          <Mail aria-hidden />
          {t("email")}
        </a>
      </DropdownMenuItem>
    ) : kind === "whatsapp" ? (
      [whatsapp, call]
    ) : (
      [call, whatsapp]
    );

  const onCopy = async () => {
    if (await copy(display)) {
      announce(t(kind === "email" ? "emailCopied" : "numberCopied"));
    } else {
      announce(t("copyFailed"), "error");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onPointerDown={() => {
            byPointer.current = true;
          }}
          onKeyDown={() => {
            byPointer.current = false;
          }}
          aria-label={t("open", { value: display })}
          className={cn(
            "text-foreground hover:bg-accent data-[state=open]:bg-accent focus-visible:ring-ring/60 -mx-2 inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-(--radius-field) px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset pointer-coarse:min-h-11",
            className,
          )}
        >
          <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 truncate">{display}</span>
          <ChevronDown
            aria-hidden
            className="text-muted-foreground size-3.5 shrink-0"
          />
        </button>
      </DropdownMenuTrigger>
      {/* The trigger already shows the value: the menu is only its actions, with
          no repeated header and no rule between them. */}
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(event) => {
          if (byPointer.current) event.preventDefault();
        }}
      >
        {actions}
        <DropdownMenuItem className={ITEM} onSelect={onCopy}>
          <Copy aria-hidden />
          {t(kind === "email" ? "copyEmail" : "copyNumber")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

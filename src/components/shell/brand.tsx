import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Brand() {
  const t = useTranslations("app");
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
        <MapPin className="size-[18px]" aria-hidden />
      </span>
      <span className="font-display font-medium text-[1.1875rem] tracking-[-0.01em]">
        {t("name")}
      </span>
    </Link>
  );
}

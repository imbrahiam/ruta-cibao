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
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <MapPin className="size-5" aria-hidden />
      </span>
      <span>{t("name")}</span>
    </Link>
  );
}

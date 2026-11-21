"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "use-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/lib/web/api";
import { resolveMunicipalityFilter } from "./list-queries";
import { useStaff } from "./staff-context";

/** Radix items cannot carry an empty value, so "all" travels as this. */
const ALL = "__all__";

/**
 * The municipality a list is narrowed to, kept in the URL so a reload, a
 * shared link and the back button all land on the same view.
 *
 * A moderator is confined to one municipality and sees only that one; the
 * server enforces the same scope, this only avoids offering a choice that
 * cannot be honoured.
 */
export function useMunicipalityFilter(): string | undefined {
  const params = useSearchParams();
  const { staffScope } = useStaff();
  return resolveMunicipalityFilter(params, staffScope);
}

export function MunicipalityFilter() {
  const t = useTranslations("admin");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { staffScope } = useStaff();
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const selected = useMunicipalityFilter() ?? ALL;

  const allowed = Array.isArray(staffScope)
    ? (municipalities.data ?? []).filter((item) => staffScope.includes(item.id))
    : (municipalities.data ?? []);
  const locked = Array.isArray(staffScope) && staffScope.length === 1;

  const change = (next: string) => {
    const query = new URLSearchParams(params);
    if (next !== ALL) query.set("municipality", next);
    else query.delete("municipality");
    const search = query.toString();
    // `scroll: false` keeps the reviewer where they were in the list.
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  };

  return (
    <Select
      value={selected}
      disabled={locked || municipalities.isPending}
      onValueChange={change}
    >
      <SelectTrigger
        aria-label={t("municipality")}
        className="min-w-0 sm:min-w-48"
      >
        {/* The visible prefix is a desk nicety; on a phone it pushed the
            refresh to a line of its own. The name stays in `aria-label`. */}
        <span className="hidden text-muted-foreground sm:inline">
          {t("municipality")}
        </span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locked ? null : <SelectItem value={ALL}>{t("all")}</SelectItem>}
        {allowed.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

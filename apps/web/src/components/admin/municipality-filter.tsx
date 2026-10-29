"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "use-intl";
import { Select } from "@/components/ui/field";
import { orpc } from "@/lib/web/api";
import { resolveMunicipalityFilter } from "./list-queries";
import { useStaff } from "./staff-context";

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
  const selected = useMunicipalityFilter() ?? "";

  const allowed = Array.isArray(staffScope)
    ? (municipalities.data ?? []).filter((item) => staffScope.includes(item.id))
    : (municipalities.data ?? []);
  const locked = Array.isArray(staffScope) && staffScope.length === 1;

  const change = (next: string) => {
    const query = new URLSearchParams(params);
    if (next) query.set("municipality", next);
    else query.delete("municipality");
    const search = query.toString();
    // `scroll: false` keeps the reviewer where they were in the list.
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="flex max-w-xs flex-col gap-1.5">
      <label htmlFor="municipality-filter" className="text-[14px] font-medium">
        {t("municipality")}
      </label>
      <Select
        id="municipality-filter"
        value={selected}
        disabled={locked || municipalities.isPending}
        onChange={(event) => change(event.target.value)}
      >
        {locked ? null : <option value="">{t("all")}</option>}
        {allowed.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/web/api";
import { useMunicipalityFilter } from "../municipality-filter";
import { ADMIN_SECTIONS, findAdminSection } from "../nav";
import { AdminEmpty } from "../page-frame";
import { useStaff } from "../staff-context";
import type { QueueSlug } from "./slugs";

/**
 * An empty queue, said about this queue only (the rest of the desk may still
 * have work), and only after a load that succeeded:
 * - with a town selected, it names the town and offers every authorised one;
 * - otherwise it points to the next queue that has something waiting;
 * - only when nothing waits anywhere does it say the desk is clear.
 */
export function QueueEmpty({ slug }: { slug: QueueSlug }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { staffScope } = useStaff();
  const municipalityId = useMunicipalityFilter();
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const counts = useQuery(orpc.moderation.counts.queryOptions());

  const place = municipalityId
    ? municipalities.data?.find((item) => item.id === municipalityId)?.name
    : undefined;
  // A moderator scoped to one town has no "all" to go back to.
  const canWiden =
    municipalityId !== undefined &&
    !(Array.isArray(staffScope) && staffScope.length === 1);

  const current = findAdminSection(`/admin/queue/${slug}`);
  const next = ADMIN_SECTIONS.find(
    (section) =>
      section !== current &&
      section.countKey !== undefined &&
      (counts.data?.[section.countKey] ?? 0) > 0,
  );
  const waiting = next?.countKey ? (counts.data?.[next.countKey] ?? 0) : 0;

  const widen = () => {
    const query = new URLSearchParams(params);
    query.delete("municipality");
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  };

  return (
    <AdminEmpty
      icon={CheckCircle2}
      className="animate-fade py-8 md:py-10"
      title={place ? q(`emptyIn.${slug}`, { place }) : q(`emptyAll.${slug}`)}
      description={canWiden || next ? undefined : q("allClear")}
      action={
        canWiden ? (
          <Button variant="outline" onClick={widen}>
            {q("seeAllMunicipalities")}
          </Button>
        ) : next ? (
          <Button variant="ghost" asChild>
            <Link href={next.href}>
              {q("reviewOther", {
                label: t(next.label as Parameters<typeof t>[0]),
                count: waiting,
              })}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

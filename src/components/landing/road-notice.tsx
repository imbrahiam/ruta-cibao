import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { landingPulse } from "@/modules/landing/overview";
import { NoticeBar } from "./notice-bar";

/** The notice bar, when — and only when — a road is closed right now. */
export async function RoadNotice() {
  await connection();
  const [pulse, t, format] = await Promise.all([
    landingPulse(),
    getTranslations("landing.notice"),
    getFormatter(),
  ]);
  const [latest] = pulse.blocked;
  if (!latest) return null;

  const others = pulse.blocked.length - 1;
  return (
    <NoticeBar
      reportIds={pulse.blocked.map((report) => report.id)}
      title={t("title", {
        category: latest.category,
        municipality: latest.municipality,
      })}
      since={t("since", {
        time: format.dateTime(new Date(latest.createdAt), {
          hour: "numeric",
          minute: "2-digit",
        }),
      })}
      more={others > 0 ? t("more", { count: others }) : null}
    />
  );
}

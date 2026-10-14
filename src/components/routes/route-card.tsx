import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import { StatusBadge, statusTone } from "@/components/ui-patterns/status-badge";
import { Link } from "@/i18n/navigation";
import type { EcoRoute } from "@/modules/routes/contracts";

const W = 160;
const H = 120;
const PAD = 16;

/**
 * The route's own shape, as its picture.
 *
 * Routes have no photo, but they have something better for choosing one: the
 * line itself. Projected flat (longitude scaled by the cosine of the latitude,
 * so a north-south trail is not squashed), fitted to the tile, and drawn the
 * way the map draws it — a pale band under a dashed green line, a dot where it
 * starts and a flag where it ends. A few hundred bytes of SVG instead of a
 * tile request.
 */
function RouteShape({ path }: { path: EcoRoute["path"] }) {
  const id = useId();
  if (path.length < 2) return null;
  const midLat =
    (path.reduce((sum, p) => sum + p.lat, 0) / path.length) * (Math.PI / 180);
  const xs = path.map((p) => p.lng * Math.cos(midLat));
  const ys = path.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-6;
  const spanY = Math.max(...ys) - minY || 1e-6;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const points = xs.map((x, i) => [
    offX + (x - minX) * scale,
    offY + ((ys[i] ?? 0) - minY) * scale,
  ]);
  const d = points
    .map(([x, y], i) => `${i ? "L" : "M"}${x?.toFixed(1)} ${y?.toFixed(1)}`)
    .join("");
  const [sx, sy] = points[0] ?? [0, 0];
  const [ex, ey] = points.at(-1) ?? [0, 0];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className="absolute inset-0 size-full"
    >
      <defs>
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="currentColor" opacity="0.12" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
      <path
        d={d}
        fill="none"
        stroke="var(--highlight)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeDasharray="5 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={sx}
        cy={sy}
        r="4.5"
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth="2.5"
      />
      <path
        d={`M${ex} ${ey}v-12l8 3.5-8 3.5`}
        fill="var(--primary)"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One route in the directory: its shape on a soft tile, the name under it,
 * where it is, and the three numbers a walker decides by.
 */
export function RouteCard({ route }: { route: EcoRoute }) {
  const t = useTranslations("routes");
  const format = useFormatter();
  return (
    <Link
      href={`/mapa?ruta=${route.id}`}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-secondary text-foreground">
        <RouteShape path={route.path} />
        {route.status !== "published" && (
          <span className="absolute top-2.5 left-2.5">
            <StatusBadge
              tone={statusTone(route.status)}
              label={t(`status.${route.status}`)}
            />
          </span>
        )}
      </span>
      <span className="mt-2.5 block px-0.5">
        <span className="line-clamp-2 font-semibold text-[17px] leading-snug tracking-[-0.01em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-2">
          {route.name}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[15px] text-muted-foreground leading-snug">
          {route.municipalityName} · {route.categoryName}
        </span>
        <span className="meta-mono mt-1.5 block text-[13px] text-foreground/75">
          {format.number(route.distanceMeters / 1000, {
            maximumFractionDigits: 1,
          })}{" "}
          {t("km")} · {t("minutes", { count: route.durationMinutes })} ·{" "}
          {t(`difficulty.${route.difficulty}`)}
        </span>
      </span>
    </Link>
  );
}

import { Link } from "@/i18n/navigation";
import type { LandingTerritory } from "@/modules/landing/overview";

/**
 * The three municipalities drawn from their official boundaries, each a link
 * into Explorar filtered to it. Paths come from PostGIS already projected, so
 * the section paints with the HTML.
 */
export function Territory({
  territory,
  label,
}: {
  territory: LandingTerritory;
  label: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${territory.width} ${territory.height}`}
      role="img"
      aria-label={label}
      className="h-auto w-full"
    >
      {territory.municipalities.map((municipality, index) => (
        <Link
          key={municipality.id}
          href={`/explorar?municipio=${municipality.id}`}
          className="group outline-none"
        >
          <path
            d={municipality.path}
            className="fill-card stroke-ink-3 transition-colors duration-200 group-hover:fill-accent-soft group-focus-visible:fill-accent-soft"
            style={{ fillOpacity: 1 - index * 0.12 }}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <text
            x={municipality.label.x}
            y={municipality.label.y}
            textAnchor="middle"
            className="fill-ink-2 font-mono text-[9px] tracking-[0.14em] uppercase group-hover:fill-accent"
          >
            {municipality.name}
          </text>
        </Link>
      ))}
    </svg>
  );
}

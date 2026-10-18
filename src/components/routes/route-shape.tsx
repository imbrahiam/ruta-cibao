import { cx } from "@/lib/cx";

/**
 * A route's own outline as a thumbnail: the path normalised into a box and
 * drawn as one line, start marked hollow and the end filled. Cheaper than a
 * map per card, and more honest than a stock photo of a trail.
 */
export function RouteShape({
  path,
  color,
  className,
}: {
  path: { lng: number; lat: number }[];
  color: string;
  className?: string;
}) {
  const xs = path.map((point) => point.lng);
  const ys = path.map((point) => point.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const pad = 14;
  const size = 100 - pad * 2;
  const offsetX = (size - ((maxX - minX) / span) * size) / 2;
  const offsetY = (size - ((maxY - minY) / span) * size) / 2;
  const points = path.map((point) => [
    pad + offsetX + ((point.lng - minX) / span) * size,
    pad + offsetY + ((maxY - point.lat) / span) * size,
  ]);
  const d = points
    .map(
      ([x, y], index) =>
        `${index ? "L" : "M"}${x?.toFixed(2)} ${y?.toFixed(2)}`,
    )
    .join(" ");
  const start = points[0];
  const end = points[points.length - 1];

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={cx(
        "bg-paper-2 [background-image:linear-gradient(color-mix(in_srgb,var(--ink)_6%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--ink)_6%,transparent)_1px,transparent_1px)] [background-size:24px_24px]",
        className,
      )}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--card)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {start ? (
        <circle
          cx={start[0]}
          cy={start[1]}
          r="3"
          fill="var(--card)"
          stroke={color}
          strokeWidth="1.6"
        />
      ) : null}
      {end ? <circle cx={end[0]} cy={end[1]} r="3" fill={color} /> : null}
    </svg>
  );
}

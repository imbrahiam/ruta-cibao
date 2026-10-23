import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { getT } from "@/lib/web/i18n";

/**
 * Real app screenshots, dropped into `apps/web/public/screenshots/<name>.png`.
 *
 * Nothing here is mocked: a file that is not there simply is not rendered, and
 * `hasScreenshot` lets the section say so honestly instead of showing empty
 * phone frames.
 */
const ROOTS = [
  path.join(process.cwd(), "public", "screenshots"),
  path.join(process.cwd(), "apps", "web", "public", "screenshots"),
];

export function hasScreenshot(name: string): boolean {
  return ROOTS.some((root) => existsSync(path.join(root, `${name}.png`)));
}

export function AppScreenshot({
  name,
  screen,
  priority = false,
}: {
  name: string;
  /** What the screen shows, already in Spanish: used for the alternative text. */
  screen: string;
  priority?: boolean;
}) {
  const t = getT("landing");
  if (!hasScreenshot(name)) return null;

  return (
    <figure className="w-full max-w-[260px] shrink-0">
      <div className="overflow-hidden rounded-frame bg-ink p-[7px] shadow-lg">
        <Image
          src={`/screenshots/${name}.png`}
          alt={t("screenshotAlt", { screen })}
          width={1170}
          height={2532}
          sizes="260px"
          priority={priority}
          className="h-auto w-full rounded-[34px]"
        />
      </div>
      <figcaption className="t-small mt-3 text-center text-ink-2">
        {screen}
      </figcaption>
    </figure>
  );
}

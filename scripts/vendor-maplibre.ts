/**
 * Puts MapLibre's web worker where the browser can fetch it.
 *
 * MapLibre 6 starts its worker from a URL relative to its own module
 * (`import.meta.url`). Once Turbopack has bundled that module into a chunk,
 * the relative URL points at a file that does not exist, the server answers
 * with an HTML 404, and the map silently draws nothing. So the worker and the
 * shared chunk it imports are copied into `public/`, under the installed
 * version, and `setWorkerUrl` points MapLibre at them (see
 * `citizen-map-maplibre.tsx`). The version in the path means an upgrade can
 * never be served a stale worker from a cache.
 *
 * Runs before `dev` and `build`; the output is gitignored.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pkg from "maplibre-gl/package.json" with { type: "json" };

const source = join("node_modules", "maplibre-gl", "dist");
const target = join("public", "vendor", "maplibre", pkg.version);
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(source, file), join(target, file));
}
console.log(`maplibre ${pkg.version} worker → ${target}`);

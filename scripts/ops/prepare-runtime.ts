/** Copy only the installed dependency graph needed by native runtime externals. */
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

// The web workspace is where the runtime externals are declared. The installer keeps a package
// there, not at the root, when another workspace pins a different version of it.
const start = existsSync(resolve("apps/web"))
  ? resolve("apps/web")
  : process.cwd();
const destination = resolve(process.argv[2] ?? "/tmp/runtime-dependencies");
const visited = new Set<string>();

type Manifest = {
  name: string;
  os?: string[];
  cpu?: string[];
  libc?: string[];
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};
function matches(values: string[] | undefined, value: string): boolean {
  if (!values) return true;
  if (values.includes(`!${value}`)) return false;
  const positive = values.filter((item) => !item.startsWith("!"));
  return positive.length === 0 || positive.includes(value);
}
function locate(name: string, parent: string): string | undefined {
  let cursor = parent;
  while (true) {
    const candidate = join(cursor, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const next = dirname(cursor);
    if (next === cursor) return;
    cursor = next;
  }
}
function copy(name: string, parent: string, optional = false) {
  const source = locate(name, parent);
  if (!source) {
    if (optional) return;
    throw new Error(`Missing runtime dependency: ${name}`);
  }
  if (visited.has(source)) return;
  const manifest = JSON.parse(
    readFileSync(join(source, "package.json"), "utf8"),
  ) as Manifest;
  if (
    !matches(manifest.os, process.platform) ||
    !matches(manifest.cpu, process.arch) ||
    !matches(manifest.libc, "glibc")
  )
    return;
  visited.add(source);
  // Both the workspace's and the root's node_modules land in one tree, each package at its path
  // below its own node_modules; the one found first (nearest the workspace) keeps the place.
  const marker = `${sep}node_modules${sep}`;
  const target = join(
    destination,
    source.slice(source.indexOf(marker) + marker.length),
  );
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, dereference: true });
  }
  for (const dependency of Object.keys(manifest.dependencies ?? {}))
    copy(dependency, source);
  for (const dependency of Object.keys(manifest.optionalDependencies ?? {}))
    copy(dependency, source, true);
}
mkdirSync(destination, { recursive: true });
for (const name of process.argv.slice(3)) copy(name, start);
console.info(`Prepared ${visited.size} runtime packages`);

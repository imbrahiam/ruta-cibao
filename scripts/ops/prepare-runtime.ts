/** Copy only the installed dependency graph needed by native runtime externals. */
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve("node_modules");
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
  const target = join(destination, relative(root, source));
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, dereference: true });
  for (const dependency of Object.keys(manifest.dependencies ?? {}))
    copy(dependency, source);
  for (const dependency of Object.keys(manifest.optionalDependencies ?? {}))
    copy(dependency, source, true);
}
mkdirSync(destination, { recursive: true });
for (const name of process.argv.slice(3)) copy(name, process.cwd());
console.info(`Prepared ${visited.size} runtime packages`);

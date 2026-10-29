/**
 * Fails when a document tells the reader to run, set or open something that
 * does not exist.
 *
 * The handover audience is a municipal contractor with no access to the people
 * who wrote this. A guide that names a deleted script is worse than no guide:
 * it spends the reader's trust and then strands them. The checks are mechanical
 * so they can run on every pull request:
 *
 *   - `bun run <name>` must be a root script.
 *   - `NAME_WITH_UNDERSCORES` in backticks must be an env var the code reads,
 *     or one documented in .env.example.
 *   - a relative Markdown link must resolve.
 *   - a backticked repo path must exist.
 *   - a backticked migration number must have a migration file.
 *   - every client-visible `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` in .env.example
 *     must be read by an app, not only by the Docker build.
 *
 * Historical documents are checked too. An archive that lies is still a lie.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const problems: string[] = [];

function report(file: string, line: number, message: string): void {
  problems.push(`${path.relative(root, file)}:${line} ${message}`);
}

async function read(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

async function exists(relative: string): Promise<boolean> {
  try {
    await stat(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

const pkg = JSON.parse(await read("package.json")) as {
  scripts?: Record<string, string>;
};
const scripts = new Set(Object.keys(pkg.scripts ?? {}));

const envExample = await read(".env.example");
const envKeys = new Set(
  envExample
    .split("\n")
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter((name): name is string => Boolean(name)),
);

const appFiles = [
  ...(await Array.fromAsync(
    new Bun.Glob("apps/web/src/**/*.{ts,tsx}").scan({ cwd: root }),
  )),
  ...(await Array.fromAsync(
    new Bun.Glob("apps/mobile/src/**/*.{ts,tsx}").scan({ cwd: root }),
  )),
  ...(await Array.fromAsync(
    new Bun.Glob("packages/**/*.{ts,tsx}").scan({ cwd: root }),
  )),
  ...(await Array.fromAsync(
    new Bun.Glob("scripts/**/*.{ts,sh}").scan({ cwd: root }),
  )),
  "apps/mobile/app.config.ts",
  "apps/mobile/eas.json",
  "apps/web/next.config.ts",
];
const appSource = (
  await Promise.all(appFiles.map((file) => read(file).catch(() => "")))
).join("\n");

const infraSource = (
  await Promise.all(
    (
      await Array.fromAsync(
        new Bun.Glob("infra/**/*.{yml,yaml,sh,Dockerfile,Caddyfile}").scan({
          cwd: root,
        }),
      )
    ).map((file) => read(file).catch(() => "")),
  )
).join("\n");

const codeSource = `${appSource}\n${infraSource}`;

const docs = [
  "README.md",
  ...(await readdir(path.join(root, "docs"))).map((file) => `docs/${file}`),
].filter((file) => file.endsWith(".md"));

const ENV_TOKEN = /`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g;
const SCRIPT_TOKEN = /bun run ([a-zA-Z0-9:_./-]+)/g;
const LINK_TOKEN = /\[[^\]]*\]\(([^)\s]+)\)/g;
const PATH_TOKEN =
  /`((?:apps|packages|scripts|infra|tests|docs|drizzle|data)\/[^`\s]+)`/g;
const MIGRATION_TOKEN = /`(00\d\d)`/g;

for (const file of docs) {
  const text = await read(file);
  const lines = text.split("\n");

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    for (const match of line.matchAll(SCRIPT_TOKEN)) {
      const name = (match[1] ?? "").replace(/[.,;:]+$/, "");
      if (name.includes("/") || name.includes(".")) {
        if (!(await exists(name))) {
          report(file, lineNumber, `runs missing file "bun run ${name}"`);
        }
        continue;
      }
      if (!scripts.has(name)) {
        report(file, lineNumber, `names missing script "bun run ${name}"`);
      }
    }

    for (const match of line.matchAll(ENV_TOKEN)) {
      const name = match[1];
      if (!name || envKeys.has(name)) continue;
      if (codeSource.includes(name)) continue;
      report(
        file,
        lineNumber,
        `names env var ${name}, which is neither in .env.example nor read by the repo`,
      );
    }

    for (const match of line.matchAll(LINK_TOKEN)) {
      const target = match[1];
      if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      const clean = target.split("#")[0];
      if (!clean) continue;
      const resolved = path.normalize(
        path.join(path.dirname(path.join(root, file)), clean),
      );
      if (!(await exists(path.relative(root, resolved)))) {
        report(file, lineNumber, `links to missing file ${target}`);
      }
    }

    for (const match of line.matchAll(PATH_TOKEN)) {
      const candidate = (match[1] ?? "").replace(/[.,;:]+$/, "");
      if (candidate.includes("*") || candidate.includes("<")) continue;
      if (!(await exists(candidate))) {
        report(file, lineNumber, `names missing path ${candidate}`);
      }
    }

    for (const match of line.matchAll(MIGRATION_TOKEN)) {
      const number = match[1];
      if (!number) continue;
      const found = await Array.fromAsync(
        new Bun.Glob(`drizzle/${number}_*.sql`).scan({ cwd: root }),
      );
      if (found.length === 0) {
        report(file, lineNumber, `names missing migration ${number}`);
      }
    }
  }
}

for (const name of envKeys) {
  if (!name.startsWith("NEXT_PUBLIC_") && !name.startsWith("EXPO_PUBLIC_")) {
    continue;
  }
  if (!appSource.includes(name)) {
    report(
      ".env.example",
      0,
      `documents ${name}, which no app reads. Delete it or wire it.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`Documentation check failed (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Documentation check passed (${docs.length} files).`);

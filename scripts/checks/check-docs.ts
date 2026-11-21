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
 *   - every fenced `bash`/`sh` block is syntactically valid shell.
 *   - every server env var the schema reads is documented in .env.example,
 *     and every documented var is read somewhere outside that file.
 *   - every client-visible `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` in .env.example
 *     must be read by an app, not only by the Docker build.
 *
 * Historical documents are checked too. An archive that lies is still a lie.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "../..");
const problems: string[] = [];

function report(file: string, line: number, message: string): void {
  problems.push(`${path.relative(root, file)}:${line} ${message}`);
}

async function read(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

/** True when git ignores the path: a local, generated file rather than a broken reference. */
function ignoredByGit(candidate: string): boolean {
  return (
    Bun.spawnSync(["git", "check-ignore", "--quiet", "--no-index", candidate], {
      cwd: root,
    }).exitCode === 0
  );
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
    new Bun.Glob("packages/**/*.{ts,tsx}").scan({ cwd: root }),
  )),
  ...(await Array.fromAsync(
    new Bun.Glob("scripts/**/*.{ts,sh}").scan({ cwd: root }),
  )),
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
const PATH_TOKEN = /`((?:apps|packages|scripts|infra|docs|native)\/[^`\s]+)`/g;
const MIGRATION_TOKEN = /`(00\d\d)`/g;

for (const file of docs) {
  const text = await read(file);
  const lines = text.split("\n");

  let fence: { language: string; start: number; body: string[] } | null = null;
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const fenceMark = /^ {0,3}```(.*)$/.exec(line);

    if (fenceMark) {
      if (fence) {
        if (["bash", "sh", "shell"].includes(fence.language)) {
          const syntax = Bun.spawnSync(["bash", "-n"], {
            stdin: new TextEncoder().encode(fence.body.join("\n")),
            stderr: "pipe",
          });
          if (syntax.exitCode !== 0) {
            report(
              file,
              fence.start,
              `fenced ${fence.language} block is not valid shell: ${syntax.stderr.toString().trim().split("\n")[0] ?? ""}`,
            );
          }
        }
        fence = null;
      } else {
        fence = {
          language: (fenceMark[1] ?? "").trim(),
          start: lineNumber,
          body: [],
        };
      }
      continue;
    }
    if (fence) fence.body.push(line);

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
      // A per-machine file the docs tell you to create (and git ignores) is not drift.
      if (!(await exists(candidate)) && !ignoredByGit(candidate)) {
        report(file, lineNumber, `names missing path ${candidate}`);
      }
    }

    for (const match of line.matchAll(MIGRATION_TOKEN)) {
      const number = match[1];
      if (!number) continue;
      const found = await Array.fromAsync(
        new Bun.Glob(`apps/web/drizzle/${number}_*.sql`).scan({ cwd: root }),
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

const envSource = await read("apps/web/src/lib/env.ts");
const schemaKeys = new Set(
  [...envSource.matchAll(/^ {4}([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]),
);
for (const name of schemaKeys) {
  if (name && !envKeys.has(name)) {
    report(
      ".env.example",
      0,
      `the server schema reads ${name} without documenting it here`,
    );
  }
}
for (const name of envKeys) {
  if (!codeSource.includes(name)) {
    report(
      ".env.example",
      0,
      `documents ${name}, which nothing outside the example reads. Delete it.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`Documentation check failed (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Documentation check passed (${docs.length} files).`);

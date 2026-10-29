/**
 * Fails when one of the five quality properties stops being provable.
 *
 * The five properties are not prose in a document; each one has an artifact a
 * machine can check on every pull request:
 *
 *   1. Critical paths tested — `docs/QUALITY.md` names a test for every one,
 *      and this script confirms the test exists by title.
 *   2. Failures observable — an empty `catch` is a lost error unless it is
 *      marked `// expected: <reason>`.
 *   3. Documents executable — `scripts/check-docs.ts` owns commands and paths;
 *      this script owns shell syntax and the executable bit.
 *   4. Dependencies degradable — `docs/QUALITY.md` names a test for every
 *      dependency failure mode.
 *   5. Releases reversible — `scripts/release.sh` runs the gates before it
 *      tags, and the restore rehearsal exists and is executable.
 *
 * The point is to make the guarantee regress loudly. A matrix row whose test
 * was renamed fails the build instead of quietly describing software that no
 * longer behaves that way.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const problems: string[] = [];

function fail(where: string, message: string): void {
  problems.push(`${where} ${message}`);
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

async function isExecutable(relative: string): Promise<boolean> {
  try {
    const info = await stat(path.join(root, relative));
    return (info.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

async function filesUnder(
  directory: string,
  pattern: RegExp,
): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await filesUnder(relative, pattern)));
    } else if (pattern.test(entry.name)) {
      found.push(relative);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Matrix parsing.
// ---------------------------------------------------------------------------

const quality = await read("docs/QUALITY.md");

type Row = Record<string, string>;

function table(marker: string): Row[] {
  const start = quality.indexOf(`<!-- quality:${marker} -->`);
  if (start === -1) {
    fail("docs/QUALITY.md", `is missing the "${marker}" matrix`);
    return [];
  }
  const body = quality.slice(start).split("\n").slice(1);
  const lines: string[] = [];
  for (const line of body) {
    if (line.startsWith("<!-- quality:") || line.startsWith("## ")) break;
    if (line.trim().startsWith("|")) lines.push(line.trim());
  }
  const cells = lines.map((line) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()),
  );
  if (cells.length < 2) {
    fail("docs/QUALITY.md", `"${marker}" matrix has no rows`);
    return [];
  }
  const [header] = cells;
  if (!header) return [];
  return cells.slice(2).map((row) => {
    const record: Row = {};
    for (const [index, name] of header.entries()) {
      record[name] = row[index] ?? "";
    }
    return record;
  });
}

const EVIDENCE = /`([^`]+\.test\.tsx?)`\s*::\s*`([^`]+)`/;
const testSources = new Map<string, string>();

async function evidence(row: Row, where: string): Promise<string | null> {
  const cell = row.Evidence ?? "";
  const match = EVIDENCE.exec(cell);
  if (!match?.[1] || !match[2]) {
    fail(where, `evidence must read \`tests/file.test.ts\` :: \`test title\``);
    return null;
  }
  const file = match[1];
  const title = match[2];
  if (!(await exists(file))) {
    fail(where, `names missing test file ${file}`);
    return null;
  }
  let source = testSources.get(file);
  if (source === undefined) {
    source = await read(file);
    testSources.set(file, source);
  }
  const quoted = [`"${title}"`, `'${title}'`, `\`${title}\``];
  if (!quoted.some((candidate) => source?.includes(candidate))) {
    fail(where, `names "${title}", which ${file} does not contain`);
    return null;
  }
  return file;
}

const criticalPaths = table("critical-paths");
const coveredTests = new Set<string>();

if (criticalPaths.length < 8) {
  fail(
    "docs/QUALITY.md",
    `lists ${criticalPaths.length} critical paths; the product has at least eight`,
  );
}
for (const [index, row] of criticalPaths.entries()) {
  const where = `docs/QUALITY.md critical path ${row.Path ?? index + 1}`;
  if (!row.Path || !row.Promise) fail(where, "needs both Path and Promise");
  const file = await evidence(row, where);
  if (file) coveredTests.add(file);
}

const degradations = table("degradation");
if (degradations.length < 6) {
  fail(
    "docs/QUALITY.md",
    `lists ${degradations.length} degradation modes; every external dependency needs one`,
  );
}
for (const [index, row] of degradations.entries()) {
  const where = `docs/QUALITY.md degradation ${row.Dependency ?? index + 1}`;
  if (!row.Dependency || !row.When || !row.Behaviour) {
    fail(where, "needs Dependency, When and Behaviour");
  }
  const file = await evidence(row, where);
  if (file) coveredTests.add(file);
}

// A suite outside the matrix is a promise nobody checks.
for (const file of await filesUnder("tests", /\.integration\.test\.ts$/)) {
  if (!quality.includes(file)) {
    fail(
      file,
      "is not named in docs/QUALITY.md, so nothing tracks its promise",
    );
  }
}

// ---------------------------------------------------------------------------
// Failure observability: no silent catches.
// ---------------------------------------------------------------------------

function emptyCatchBodies(
  source: string,
): Array<{ line: number; body: string }> {
  const found: Array<{ line: number; body: string }> = [];
  for (const match of source.matchAll(/catch\s*(?:\([^)]*\))?\s*\{/g)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let index = start;
    while (index < source.length && depth > 0) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      index += 1;
    }
    const body = source.slice(start, index - 1);
    const stripped = body
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();
    if (stripped === "") {
      found.push({
        line: source.slice(0, match.index).split("\n").length,
        body: body.trim(),
      });
    }
  }
  return found;
}

const sourceFiles = [
  ...(await filesUnder("apps/web/src", /\.(ts|tsx)$/)),
  ...(await filesUnder("apps/mobile/src", /\.(ts|tsx)$/)),
  ...(await filesUnder("packages", /\.(ts|tsx)$/)),
  ...(await filesUnder("scripts", /\.(ts|tsx)$/)),
];
for (const file of sourceFiles) {
  const source = await read(file);
  for (const { line, body } of emptyCatchBodies(source)) {
    if (!/\/\/ expected: \S/.test(body)) {
      fail(
        `${file}:${line}`,
        "swallows an error; log it, return a deliberate value, or mark it `// expected: <reason>`",
      );
    }
  }
  for (const match of source.matchAll(
    /\.catch\(\(\) => (?:undefined|\{\})\)/g,
  )) {
    const line = source.slice(0, match.index).split("\n").length;
    const text = source.split("\n")[line - 1] ?? "";
    if (!/\/\/ expected: \S/.test(text)) {
      fail(
        `${file}:${line}`,
        "discards an error; handle it or append `// expected: <reason>`",
      );
    }
  }
  for (const match of source.matchAll(/\/\/ expected:/g)) {
    const text = source.slice(match.index).split("\n")[0] ?? "";
    if (!/\/\/ expected: \S/.test(text)) {
      fail(`${file}`, "has an expected-error marker without a reason");
    }
  }
}

// ---------------------------------------------------------------------------
// Documents and shell: syntax, executable bit.
// ---------------------------------------------------------------------------

const shellFiles = [
  ...(await filesUnder("scripts", /\.sh$/)),
  ...(await filesUnder("infra", /\.sh$/)),
];
for (const file of shellFiles) {
  const syntax = Bun.spawnSync(["bash", "-n", path.join(root, file)], {
    stderr: "pipe",
    stdout: "pipe",
  });
  if (syntax.exitCode !== 0) {
    fail(file, `fails bash -n: ${syntax.stderr.toString().trim()}`);
  }
  if (!(await isExecutable(file))) {
    fail(file, "is not executable");
  }
}

// ---------------------------------------------------------------------------
// Release reversibility.
// ---------------------------------------------------------------------------

const release = await read("scripts/release.sh");
const tagAt = release.indexOf("git tag");
if (tagAt === -1) {
  fail("scripts/release.sh", "never creates a tag");
} else {
  const beforeTag = release.slice(0, tagAt);
  for (const gate of [
    "bun run build",
    "bun run check:quality",
    "bun run check:docs",
    "infra/restore-rehearsal.sh",
  ]) {
    if (!beforeTag.includes(gate)) {
      fail("scripts/release.sh", `tags without running \`${gate}\``);
    }
  }
}
for (const script of ["infra/restore-rehearsal.sh", "infra/restore.sh"]) {
  if (!(await exists(script)))
    fail(script, "is missing, so a release cannot be undone");
  else if (!(await isExecutable(script))) fail(script, "is not executable");
}
if (!/rollback|restore/i.test(release)) {
  fail("scripts/release.sh", "does not tell the operator how to roll back");
}

// Forward-only migrations: unique, increasing prefixes.
const migrations = (await readdir(path.join(root, "drizzle")))
  .filter((name) => /^\d{4}_.*\.sql$/.test(name))
  .sort();
const numbers = migrations.map((name) => Number(name.slice(0, 4)));
for (const [index, number] of numbers.entries()) {
  if (index > 0 && number !== (numbers[index - 1] ?? 0) + 1) {
    fail(
      "drizzle",
      `migration numbering jumps from ${String(numbers[index - 1]).padStart(4, "0")} to ${String(number).padStart(4, "0")}`,
    );
  }
}
if (numbers.length === 0) fail("drizzle", "has no migrations");

if (problems.length > 0) {
  console.error(`Quality check failed (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `Quality check passed (${criticalPaths.length} critical paths, ${degradations.length} degradation modes, ${sourceFiles.length} sources, ${shellFiles.length} scripts, ${migrations.length} migrations).`,
);

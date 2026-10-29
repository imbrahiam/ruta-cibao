/**
 * The two rules the quality gate applies to source text, kept separate so they
 * can be tested without running the whole repository check.
 *
 * A title in a comment or under `test.skip` is not evidence. An empty catch is
 * a lost error unless the body says why. Both rules are small enough to read,
 * and both have a test that proves they reject the failure they exist for.
 */

export function emptyCatchBodies(
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

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Catches that contain only comments and do not say why that is expected. */
export function unmarkedCatchBodies(
  source: string,
): Array<{ line: number; body: string }> {
  return emptyCatchBodies(source).filter(
    ({ body }) => !/\/\/ expected: \S/.test(body),
  );
}

/**
 * Whether `source` declares a test with this exact title.
 *
 * It must be an actual `test(...)` or `it(...)` call, not a string in a
 * comment and not `test.skip(...)`. A title that survives a rename but no
 * longer runs is the failure this gate exists to catch.
 */
export function declaresTest(source: string, title: string): boolean {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const name = escaped(title);
  const declaration = new RegExp(
    `\\b(?:test|it)\\(\\s*(?:"${name}"|'${name}'|\`${name}\`)\\s*[,)]`,
  );
  return declaration.test(withoutComments);
}

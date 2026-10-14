/** Retain dependency license notices when packages are bundled into runtime JS. */
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const seen = new Set<string>();
const notices = [
  "Third-party dependency notices (including build dependencies).\n",
];
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.name.startsWith("@")) {
      scan(path);
      continue;
    }
    if (!existsSync(join(path, "package.json"))) continue;
    const resolved = realpathSync(path);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const manifest = JSON.parse(
      readFileSync(join(path, "package.json"), "utf8"),
    ) as { name: string; version: string; license?: string };
    notices.push(
      `\n--- ${manifest.name}@${manifest.version} (${manifest.license ?? "see notice"}) ---\n`,
    );
    for (const file of readdirSync(path, { withFileTypes: true })) {
      if (
        file.isFile() &&
        /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i.test(file.name)
      )
        notices.push(readFileSync(join(path, file.name), "utf8"));
    }
    if (existsSync(join(path, "node_modules")))
      scan(join(path, "node_modules"));
  }
}
scan("node_modules");
writeFileSync(
  process.argv[2] ?? "/tmp/THIRD-PARTY-NOTICES.txt",
  notices.join("\n"),
);

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, ".release-check", new Date().toISOString().replace(/[:.]/g, "-"));
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" })
  .split(String.fromCharCode(0))
  .filter(file => file && existsSync(resolve(root, file)));
if (!files.includes("src/releaseNotes.ts")) throw new Error("Required release notes are excluded from Git source export");
if (!files.includes("THIRD-PARTY-NOTICES.md")) throw new Error("Dependency notices are excluded from Git source export");
for (const file of files) {
  const output = resolve(target, file);
  const location = relative(target, output);
  if (location === ".." || location.startsWith(".." + sep) || location.startsWith(sep)) throw new Error("Source export path escapes destination");
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(resolve(root, file), output);
}
console.log(JSON.stringify({ directory: target, files: files.length }));

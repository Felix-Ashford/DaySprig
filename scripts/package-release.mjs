import { mkdir, copyFile, readFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const output = join("dist", "daysprig");
const files = ["main.js", "manifest.json", "styles.css", "LICENSE", "NOTICE.md", "THIRD-PARTY-NOTICES.md", "THIRD-PARTY-SOURCE.md"];
for (const file of files) await access(file);
await mkdir(output, { recursive: true });
for (const file of files) await copyFile(file, join(output, file));
const sourceRoot = resolve("node_modules/ical.js");
const metadata = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
if (metadata.license !== "MPL-2.0") throw new Error("Review ical.js source packaging for changed license");
const archive = resolve("dist", "ical.js-" + metadata.version + "-source.tar.gz");
const result = spawnSync("tar", ["-czf", archive, "-C", sourceRoot, "lib", "dist", "LICENSE", "README.md", "package.json"], { stdio: "inherit" });
if (result.error || result.status !== 0) throw result.error || new Error("Could not create MPL source archive");
console.log("Release files: " + output + "; corresponding MPL source: " + archive);

import { readFileSync, statSync } from "node:fs";
import { Script } from "node:vm";
import { generateNotices } from "./generate-third-party-notices.mjs";

const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const versions = readJson("versions.json");
if (manifest.id !== "daysprig" || manifest.name !== "DaySprig" || !manifest.isDesktopOnly) throw new Error("Invalid DaySprig manifest");
if (pkg.version !== manifest.version || versions[manifest.version] !== manifest.minAppVersion) throw new Error("Release version metadata differs");
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== manifest.version) throw new Error("Tag must match manifest version without a v prefix");
for (const file of ["main.js", "manifest.json", "styles.css", "LICENSE", "NOTICE.md", "THIRD-PARTY-NOTICES.md"]) {
  if (!statSync(file).size) throw new Error("Empty artifact: " + file);
}
const main = readFileSync("main.js", "utf8");
new Script(main, { filename: "main.js" });
const notices = readFileSync("THIRD-PARTY-NOTICES.md", "utf8");
const expected = generateNotices(readJson("build-metadata.json"));
if (notices !== expected) throw new Error("Third-party notices do not match bundle metadata");
const legal = [readFileSync("LICENSE", "utf8"), readFileSync("NOTICE.md", "utf8"), notices].join("\n\n");
const comment = legal.split("\n").map(line => "// " + line).join("\n") + "\n";
if (!main.startsWith(comment)) throw new Error("Bundle is missing complete project/dependency notices");
console.log("Release metadata, bundle syntax, artifacts and embedded notices verified");

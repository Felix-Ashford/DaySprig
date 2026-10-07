import { mkdir, copyFile, access } from "node:fs/promises";
import { join } from "node:path";

const output = join("dist", "daysprig");
const files = ["main.js", "manifest.json", "styles.css", "LICENSE", "NOTICE.md", "THIRD-PARTY-NOTICES.md"];
for (const file of files) await access(file);
await mkdir(output, { recursive: true });
for (const file of files) await copyFile(file, join(output, file));
console.log("Release files: " + output);

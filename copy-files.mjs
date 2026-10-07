import { copyFile, mkdir, readFile, access } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

let destination = process.env.OBSIDIAN_PLUGIN_PATH;
if (!destination) {
  try { destination = (await readFile(".copy-files.local", "utf8")).trim(); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
if (!destination) throw new Error("Set OBSIDIAN_PLUGIN_PATH or .copy-files.local to a test vault's daysprig plugin directory.");
const target = resolve(destination);
if (basename(target).toLowerCase() !== "daysprig") throw new Error("Copy destination must be named daysprig; refusing to overwrite another plugin.");
const files = ["main.js", "manifest.json", "styles.css", "LICENSE", "NOTICE.md", "THIRD-PARTY-NOTICES.md"];
for (const file of files) await access(file);
await mkdir(target, { recursive: true });
for (const file of files) await copyFile(file, join(target, file));
console.log("Copied release files to " + target);

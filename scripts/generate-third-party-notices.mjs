import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowed = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "Apache-2.0", "MPL-2.0"]);
const newline = String.fromCharCode(10);

export function generateNotices(metafile) {
  const roots = new Set();
  for (const output of Object.values(metafile.outputs)) {
    for (const [input, info] of Object.entries(output.inputs)) {
      if (info.bytesInOutput === 0) continue;
      const parts = input.replaceAll("\\", "/").split("/");
      const at = parts.lastIndexOf("node_modules");
      if (at < 0) continue;
      roots.add(parts.slice(0, at + (parts[at + 1].startsWith("@") ? 3 : 2)).join("/"));
    }
  }
  const packages = [...roots].map(relative => {
    const directory = resolve(root, relative);
    const meta = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    if (!allowed.has(meta.license)) throw new Error("Review required for bundled dependency: " + meta.name + " (" + meta.license + ")");
    const names = readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice|copyrightnotice)([.-].*)?$/i.test(name)).sort();
    if (!names.some(name => /^(licen[cs]e|copying)/i.test(name))) throw new Error("Missing license text for bundled dependency " + meta.name);
    const sections = names.map(name => ["### " + name, "", readFileSync(join(directory, name), "utf8").replace(/\r/g, "").trim()].join(newline));
    const upstream = typeof meta.repository === "string" ? meta.repository : meta.repository?.url;
    return ["## " + meta.name + " " + meta.version, "", "License: " + meta.license, ...(upstream ? ["", "Upstream: " + upstream] : []), "", sections.join(newline + newline)].join(newline);
  }).sort((a, b) => a.localeCompare(b, "en"));
  const text = ["# Third-Party Notices", "", "Generated from packages contributing code to the DaySprig bundle.", "Development tools and Obsidian-provided external modules are not redistributed by this bundle.", "Each component retains its own license; the DaySprig MIT license does not replace those terms.", "For MPL-2.0 source availability, see THIRD-PARTY-SOURCE.md and the source archive accompanying releases.", "", packages.join(newline + newline + "---" + newline + newline), ""].join(newline);
  writeFileSync(join(root, "THIRD-PARTY-NOTICES.md"), text);
  console.log("Collected full license texts for " + packages.length + " bundled packages");
  return text;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = join(root, "build-metadata.json");
  if (!existsSync(path)) throw new Error("Run npm run build before generating notices");
  generateNotices(JSON.parse(readFileSync(path, "utf8")));
}

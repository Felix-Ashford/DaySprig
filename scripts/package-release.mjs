import { mkdir, copyFile, access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

const output = join("dist", "daysprig");
const files = ["main.js", "manifest.json", "styles.css", "LICENSE", "NOTICE.md", "THIRD-PARTY-NOTICES.md"];
for (const file of files) await access(file);
await mkdir(output, { recursive: true });
for (const file of files) await copyFile(file, join(output, file));
console.log("Release files: " + output);

// A standard ZIP with a single daysprig/ folder, ready to extract into plugins/.
// Fixed timestamps make identical release inputs produce identical archives.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const localEntries = [];
const directoryEntries = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from("daysprig/" + file, "utf8");
  const data = await readFile(join(output, file));
  const compressed = deflateRawSync(data);
  const checksum = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0x0021, 12); // 1980-01-01
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  localEntries.push(local, name, compressed);

  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50, 0);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  local.copy(directory, 8, 6, 30);
  directory.writeUInt32LE(offset, 42);
  directoryEntries.push(directory, name);
  offset += local.length + name.length + compressed.length;
}
const centralDirectory = Buffer.concat(directoryEntries);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);
const { version } = JSON.parse(await readFile("manifest.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid release version");
const archive = join("dist", `daysprig-${version}.zip`);
await writeFile(archive, Buffer.concat([...localEntries, centralDirectory, end]));
console.log("Install archive: " + archive);

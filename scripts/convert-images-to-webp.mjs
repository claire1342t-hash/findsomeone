import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "src/assets");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.png$/i.test(name)) out.push(full);
  }
  return out;
}

const pngFiles = walk(assetsDir);
let saved = 0;

for (const pngPath of pngFiles) {
  const webpPath = pngPath.replace(/\.png$/i, ".webp");
  const input = fs.readFileSync(pngPath);
  await sharp(input)
    .webp({ quality: 82, effort: 4 })
    .toFile(webpPath);
  const before = fs.statSync(pngPath).size;
  const after = fs.statSync(webpPath).size;
  saved += before - after;
  console.log(`${path.relative(root, pngPath)}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);
}

console.log(`\nConverted ${pngFiles.length} files, saved ~${(saved / 1024 / 1024).toFixed(1)}MB`);

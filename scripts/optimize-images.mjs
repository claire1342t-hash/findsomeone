import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "src/assets");

/** @type {{ dir: string, maxWidth: number, variant?: { suffix: string, width: number, quality: number } }[]} */
const RULES = [
  { dir: "illustrations", maxWidth: 960, variant: { suffix: "-480w", width: 480, quality: 78 } },
  {
    dir: "illustrations/profile_picture",
    maxWidth: 192,
    variant: { suffix: "-96w", width: 96, quality: 82 },
  },
];

function listWebps(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".webp") && !/-\d+w\.webp$/.test(name))
    .map((name) => path.join(dir, name));
}

async function optimizeFile(filePath, { maxWidth, variant }) {
  const input = fs.readFileSync(filePath);
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  let working = sharp(input);

  if (width > maxWidth) {
    working = working.resize({ width: maxWidth, withoutEnlargement: true });
    await working.webp({ quality: 82, effort: 4 }).toFile(filePath);
    working = sharp(fs.readFileSync(filePath));
    console.log(`  cap ${path.basename(filePath)} → ${maxWidth}px`);
  }

  if (variant && width > variant.width) {
    const variantPath = filePath.replace(/\.webp$/i, `${variant.suffix}.webp`);
    await sharp(fs.readFileSync(filePath))
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: variant.quality, effort: 4 })
      .toFile(variantPath);
    const kb = (fs.statSync(variantPath).size / 1024).toFixed(1);
    console.log(`  ${path.basename(variantPath)} (${kb} KB)`);
  }
}

for (const rule of RULES) {
  const dir = path.join(assetsDir, rule.dir);
  if (!fs.existsSync(dir)) continue;
  console.log(`\n${rule.dir}:`);
  for (const file of listWebps(dir)) {
    console.log(path.basename(file));
    await optimizeFile(file, rule);
  }
}

console.log("\nDone.");

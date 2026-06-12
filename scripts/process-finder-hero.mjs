import { removeBackground } from "@imgly/background-removal-node";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function cutoutFromFile(sourcePath) {
  const input = readFileSync(sourcePath);
  const blob = await removeBackground(new Blob([input], { type: "image/png" }));
  return Buffer.from(await blob.arrayBuffer());
}

const womanCutout = await cutoutFromFile(path.join(__dirname, ".finder-woman-source.png"));
const womanMeta = await sharp(womanCutout).metadata();

// Light crop: remove logo band + right UI art; keep full figure prominence.
const woman = await sharp(womanCutout)
  .extract({
    left: 0,
    top: Math.min(80, Math.floor(womanMeta.height * 0.08)),
    width: Math.min(Math.floor(womanMeta.width * 0.62), womanMeta.width),
    height: womanMeta.height - Math.min(80, Math.floor(womanMeta.height * 0.08)),
  })
  .png()
  .toBuffer();

writeFileSync(path.join(root, "public", "finder", "finder-hero-woman.png"), woman);

const doctorCutout = await cutoutFromFile(path.join(__dirname, ".doctor-nikos-source.png"));
const doctor = await sharp(doctorCutout)
  .resize(160, 160, { fit: "cover", position: "top" })
  .png()
  .toBuffer();

writeFileSync(path.join(root, "public", "finder", "dr-nikos.png"), doctor);

console.log("Wrote public/finder/finder-hero-woman.png and public/finder/dr-nikos.png");

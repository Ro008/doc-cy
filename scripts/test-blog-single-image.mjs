import fs from "node:fs";
import path from "node:path";

const blogDir = path.join(process.cwd(), "content", "blog");

function listPostFiles(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".mdx") && file !== "_template.mdx")
    .map((file) => path.join(dirPath, file));
}

function countMarkdownImages(content) {
  const matches = content.match(/!\[[^\]]*\]\([^)]+\)/g);
  return matches ? matches.length : 0;
}

function parseFrontmatterAndBody(raw) {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch) {
    return { frontmatter: "", body: raw };
  }

  const frontmatter = frontmatterMatch[1];
  const body = raw.slice(frontmatterMatch[0].length);
  return { frontmatter, body };
}

function countFrontmatterImage(frontmatter) {
  const matches = frontmatter.match(/^image:\s*["'][^"']+["']\s*$/m);
  return matches ? 1 : 0;
}

const postFiles = listPostFiles(blogDir);
const failures = [];

for (const filePath of postFiles) {
  const raw = fs.readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatterAndBody(raw);

  const frontmatterImageCount = countFrontmatterImage(frontmatter);
  const markdownImageCount = countMarkdownImages(body);
  const totalImageCount = frontmatterImageCount + markdownImageCount;

  if (totalImageCount !== 1) {
    failures.push(
      `${path.relative(process.cwd(), filePath)} -> expected 1 total image, got ${totalImageCount} (frontmatter: ${frontmatterImageCount}, markdown: ${markdownImageCount})`,
    );
  }
}

if (failures.length > 0) {
  console.error("Blog image rule failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`OK: ${postFiles.length} blog posts with exactly one image each.`);

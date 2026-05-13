import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { promises as fs } from "node:fs";
import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import { createElement } from "react";
import remarkGfm from "remark-gfm";
import { BlogMdxImage } from "@/components/blog/BlogMdxImage";

const BLOG_CONTENT_DIR = path.join(process.cwd(), "content", "blog");
const CYPRUS_TIMEZONE = "Europe/Nicosia";

/** GFM = GitHub-flavored Markdown (tables, strikethrough, etc.) for blog MDX. */
const blogMdxCompileOptions = {
  parseFrontmatter: true,
  mdxOptions: {
    remarkPlugins: [remarkGfm],
  },
};

type BlogFrontmatter = {
  title: string;
  description: string;
  date?: string;
  publishedAt?: string;
  /**
   * Optional. If set to a date **after** `date`, overrides the Git-derived "Last updated" line.
   * Normally you do not need this: CI uses full `git log` history (see workflows `fetch-depth: 0`).
   */
  lastUpdated?: string;
  updatedAt?: string;
  author?: string;
  tags?: string[];
  district?: string;
  image?: string;
  /** When true, skip the default Paphos finder aside (e.g. post already has a DocCy CTA in the body). */
  hidePaphosCta?: boolean;
};

export type BlogPostMeta = BlogFrontmatter & {
  slug: string;
};

export type BlogPost = BlogPostMeta & {
  content: React.ReactNode;
};

function normalizeSlug(fileName: string): string {
  return fileName.replace(/\.mdx$/i, "").trim().toLowerCase();
}

function normalizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function normalizeDistrict(value: unknown): string | undefined {
  const district = String(value ?? "").trim().toLowerCase();
  return district || undefined;
}

/** ISO date YYYY-MM-DD */
function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/**
 * Only expose `updatedAt` when the author set lastUpdated/updatedAt **after** publication.
 * Same calendar day as `date` does not count (first publish / no real revision yet).
 */
function effectiveUpdatedAtAfterPublication(
  publishedAt: string,
  rawUpdated: string | undefined
): string | undefined {
  const candidate = String(rawUpdated ?? "").trim();
  if (!candidate) return undefined;

  const pub = publishedAt.trim();
  if (isIsoDateOnly(pub) && isIsoDateOnly(candidate)) {
    if (candidate > pub) return candidate;
    return undefined;
  }

  const pubMs = new Date(pub).getTime();
  const updMs = new Date(candidate).getTime();
  if (Number.isNaN(pubMs) || Number.isNaN(updMs)) return undefined;
  if (updMs > pubMs) return candidate;
  return undefined;
}

function findBlogFileNameForSlugSync(slug: string): string {
  try {
    const files = readdirSync(BLOG_CONTENT_DIR);
    const hit = files.find(
      (f) =>
        f.toLowerCase().endsWith(".mdx") &&
        !path.basename(f).startsWith("_") &&
        normalizeSlug(f) === slug
    );
    if (hit) return hit;
  } catch {
    /* missing blog dir */
  }
  return `${slug}.mdx`;
}

/**
 * Last commit touching this MDX, as YYYY-MM-DD (committer date).
 * Uses committer date so merges to main reflect when the change landed, not only author timestamp.
 * Undefined if Git unavailable or shallow history hides the file's last edit.
 */
function getGitLastCommitDateShortForBlogFile(fileName: string): string | undefined {
  if (process.env.BLOG_SKIP_GIT_UPDATED === "1") return undefined;
  const rel = path.posix.join("content", "blog", fileName.split("\\").join("/"));
  try {
    const out = execFileSync("git", ["log", "-1", "--follow", "--format=%cd", "--date=short", "--", rel], {
      encoding: "utf8",
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 * 1024,
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch {
    /* no .git, shallow clone, git missing, path not in history */
  }
  return undefined;
}

function laterIsoDate(a: string | undefined, b: string | undefined): string | undefined {
  if (a && b) return a > b ? a : b;
  return a ?? b;
}

function renderMdxAnchor({
  href,
  children,
  ...props
}: {
  href?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  const target = String(href ?? "").trim();
  if (!target) return createElement("a", props, children);
  const isInternal = target.startsWith("/") || target.startsWith("#");
  if (isInternal) {
    return createElement(Link, { href: target, ...props }, children);
  }
  return createElement("a", { href: target, ...props }, children);
}

function normalizeFrontmatter(
  frontmatter: Partial<BlogFrontmatter>,
  slug: string,
  fileName?: string
): BlogPostMeta {
  const title = String(frontmatter.title ?? "").trim();
  const description = String(frontmatter.description ?? "").trim();
  const publishedAt = String(frontmatter.date ?? frontmatter.publishedAt ?? "").trim();
  if (!title || !description || !publishedAt) {
    throw new Error(
      `Post "${slug}" is missing required frontmatter (title, description, date).`
    );
  }

  const rawUpdated =
    String(frontmatter.lastUpdated ?? "").trim() ||
    String(frontmatter.updatedAt ?? "").trim() ||
    undefined;
  const manual = effectiveUpdatedAtAfterPublication(publishedAt, rawUpdated);
  const resolvedFile = fileName ?? findBlogFileNameForSlugSync(slug);
  const gitDay = getGitLastCommitDateShortForBlogFile(resolvedFile);
  const fromGit = gitDay ? effectiveUpdatedAtAfterPublication(publishedAt, gitDay) : undefined;
  const updatedAt = laterIsoDate(manual, fromGit);
  const author = String(frontmatter.author ?? "").trim() || "DocCy Editorial Team";
  const image = String(frontmatter.image ?? "").trim() || undefined;
  const hidePaphosCta = Boolean(frontmatter.hidePaphosCta);
  return {
    slug,
    title,
    description,
    publishedAt,
    updatedAt,
    author,
    tags: normalizeTagList(frontmatter.tags),
    district: normalizeDistrict(frontmatter.district),
    image,
    hidePaphosCta,
  };
}

function getCyprusTodayIsoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CYPRUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isPublishedByNow(publishedAt: string, now = new Date()): boolean {
  const raw = publishedAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    // Date-only publishing uses Cyprus local date (EET/EEST aware).
    return raw <= getCyprusTodayIsoDate(now);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= now.getTime();
}

function toIsoDatePart(value: string): string | null {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function addDaysIsoDate(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function readPostSourceBySlug(slug: string): Promise<string | null> {
  const fullPath = path.join(BLOG_CONTENT_DIR, `${slug}.mdx`);
  try {
    return await fs.readFile(fullPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getAllBlogPostMeta(): Promise<BlogPostMeta[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(BLOG_CONTENT_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const mdxFiles = files.filter(
    (file) => file.toLowerCase().endsWith(".mdx") && !path.basename(file).startsWith("_")
  );
  const posts = await Promise.all(
    mdxFiles.map(async (fileName) => {
      const slug = normalizeSlug(fileName);
      const source = await fs.readFile(path.join(BLOG_CONTENT_DIR, fileName), "utf8");
      const { frontmatter } = await compileMDX<Partial<BlogFrontmatter>>({
        source,
        options: blogMdxCompileOptions,
        components: {
          a: renderMdxAnchor,
          img: BlogMdxImage,
        },
      });
      return normalizeFrontmatter(frontmatter, slug, fileName);
    })
  );

  return posts
    .filter((post) => isPublishedByNow(post.publishedAt))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

async function getAllBlogPostMetaIncludingScheduled(): Promise<BlogPostMeta[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(BLOG_CONTENT_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const mdxFiles = files.filter(
    (file) => file.toLowerCase().endsWith(".mdx") && !path.basename(file).startsWith("_")
  );
  const posts = await Promise.all(
    mdxFiles.map(async (fileName) => {
      const slug = normalizeSlug(fileName);
      const source = await fs.readFile(path.join(BLOG_CONTENT_DIR, fileName), "utf8");
      const { frontmatter } = await compileMDX<Partial<BlogFrontmatter>>({
        source,
        options: blogMdxCompileOptions,
        components: {
          a: renderMdxAnchor,
          img: BlogMdxImage,
        },
      });
      return normalizeFrontmatter(frontmatter, slug, fileName);
    })
  );

  return posts.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
}

export async function suggestNextBlogPublishDates(count: number): Promise<string[]> {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (safeCount === 0) return [];

  const allPosts = await getAllBlogPostMetaIncludingScheduled();
  const todayInCyprus = getCyprusTodayIsoDate();
  const latestExistingDate = allPosts
    .map((post) => toIsoDatePart(post.publishedAt))
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => a.localeCompare(b))
    .at(-1);

  const baseDate = latestExistingDate && latestExistingDate > todayInCyprus ? latestExistingDate : todayInCyprus;
  const scheduled: string[] = [];
  for (let i = 1; i <= safeCount; i += 1) {
    scheduled.push(addDaysIsoDate(baseDate, i));
  }
  return scheduled;
}

export async function suggestNextBlogPublishDate(): Promise<string> {
  const [next] = await suggestNextBlogPublishDates(1);
  return next;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const source = await readPostSourceBySlug(normalizedSlug);
  if (!source) return null;
  if (normalizedSlug.startsWith("_")) return null;

  const { content, frontmatter } = await compileMDX<Partial<BlogFrontmatter>>({
    source,
    options: blogMdxCompileOptions,
    components: {
      a: renderMdxAnchor,
      img: BlogMdxImage,
    },
  });

  const fileName = `${normalizedSlug}.mdx`;
  const meta = normalizeFrontmatter(frontmatter, normalizedSlug, fileName);
  if (!isPublishedByNow(meta.publishedAt)) {
    return null;
  }

  return {
    ...meta,
    content,
  };
}

export function postNeedsPaphosCta(
  post: Pick<BlogPostMeta, "slug" | "district" | "tags" | "hidePaphosCta">
): boolean {
  if (post.hidePaphosCta) return false;
  if (post.district === "paphos") return true;
  if (post.slug.includes("paphos")) return true;
  return (post.tags ?? []).some((tag) => tag.toLowerCase() === "paphos");
}

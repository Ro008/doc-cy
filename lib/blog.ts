import path from "node:path";
import { promises as fs } from "node:fs";
import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import { createElement } from "react";
import { BlogMdxImage } from "@/components/blog/BlogMdxImage";

const BLOG_CONTENT_DIR = path.join(process.cwd(), "content", "blog");
const CYPRUS_TIMEZONE = "Europe/Nicosia";

type BlogFrontmatter = {
  title: string;
  description: string;
  date?: string;
  publishedAt?: string;
  lastUpdated?: string;
  updatedAt?: string;
  author?: string;
  tags?: string[];
  district?: string;
  image?: string;
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

function normalizeFrontmatter(frontmatter: Partial<BlogFrontmatter>, slug: string): BlogPostMeta {
  const title = String(frontmatter.title ?? "").trim();
  const description = String(frontmatter.description ?? "").trim();
  const publishedAt = String(frontmatter.date ?? frontmatter.publishedAt ?? "").trim();
  if (!title || !description || !publishedAt) {
    throw new Error(
      `Post "${slug}" is missing required frontmatter (title, description, date).`
    );
  }

  const updatedAt = String(frontmatter.lastUpdated ?? frontmatter.updatedAt ?? "").trim() || undefined;
  const author = String(frontmatter.author ?? "").trim() || "DocCy Editorial Team";
  const image = String(frontmatter.image ?? "").trim() || undefined;
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
        options: {
          parseFrontmatter: true,
        },
        components: {
          a: renderMdxAnchor,
          img: BlogMdxImage,
        },
      });
      return normalizeFrontmatter(frontmatter, slug);
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
        options: {
          parseFrontmatter: true,
        },
        components: {
          a: renderMdxAnchor,
          img: BlogMdxImage,
        },
      });
      return normalizeFrontmatter(frontmatter, slug);
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
    options: {
      parseFrontmatter: true,
    },
    components: {
      a: renderMdxAnchor,
      img: BlogMdxImage,
    },
  });

  const meta = normalizeFrontmatter(frontmatter, normalizedSlug);
  if (!isPublishedByNow(meta.publishedAt)) {
    return null;
  }

  return {
    ...meta,
    content,
  };
}

export function postNeedsPaphosCta(post: Pick<BlogPostMeta, "slug" | "district" | "tags">): boolean {
  if (post.district === "paphos") return true;
  if (post.slug.includes("paphos")) return true;
  return (post.tags ?? []).some((tag) => tag.toLowerCase() === "paphos");
}

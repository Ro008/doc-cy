import path from "node:path";
import { promises as fs } from "node:fs";
import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import { createElement } from "react";
import { BlogMdxImage } from "@/components/blog/BlogMdxImage";

const BLOG_CONTENT_DIR = path.join(process.cwd(), "content", "blog");

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

  return posts.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
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

  return {
    ...normalizeFrontmatter(frontmatter, normalizedSlug),
    content,
  };
}

export function postNeedsPaphosCta(post: Pick<BlogPostMeta, "slug" | "district" | "tags">): boolean {
  if (post.district === "paphos") return true;
  if (post.slug.includes("paphos")) return true;
  return (post.tags ?? []).some((tag) => tag.toLowerCase() === "paphos");
}

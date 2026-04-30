import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PendingLink } from "@/components/navigation/PendingLink";
import { getAllBlogPostMeta, getBlogPostBySlug, postNeedsPaphosCta } from "@/lib/blog";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { BlogMdxImage } from "@/components/blog/BlogMdxImage";

type BlogPostPageProps = {
  params: {
    slug: string;
  };
};

function toAbsoluteImageUrl(image: string | undefined, siteBase: string): string | undefined {
  const raw = String(image ?? "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${siteBase}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function generateStaticParams() {
  const posts = await getAllBlogPostMeta();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const siteBase = siteUrl.replace(/\/+$/, "");
  const canonicalPath = `/blog/${post?.slug ?? params.slug}`;
  const defaultOgImage = `${siteBase}/showcase/16-premium-storefront.png`;
  if (!post) {
    return {
      title: "Blog post not found | DocCy",
      description: "The requested article could not be found.",
    };
  }

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${siteBase}${canonicalPath}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      images: [
        {
          url: toAbsoluteImageUrl(post.image, siteBase) || defaultOgImage,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [toAbsoluteImageUrl(post.image, siteBase) || defaultOgImage],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await getBlogPostBySlug(params.slug);
  if (!post) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const articleUrl = `${siteUrl.replace(/\/+$/, "")}/blog/${post.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author || "DocCy Editorial Team",
    },
    mainEntityOfPage: articleUrl,
    url: articleUrl,
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(articleJsonLd) }}
      />

      <article className="mx-auto max-w-3xl rounded-2xl border border-emerald-300/20 bg-slate-900/70 p-4 shadow-[0_0_22px_-12px_rgba(52,211,153,0.6)] sm:p-6">
        <div className="mb-5 flex items-center justify-between border-b border-slate-800/80 pb-4">
          <PendingLink href="/finder" className="inline-flex items-baseline hover:opacity-90">
            <DocCyWordmark />
          </PendingLink>
          <PendingLink href="/blog" className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
            ← Back to Blog
          </PendingLink>
        </div>
        <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
          {post.title}
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-emerald-300/90">
          {formatDate(post.publishedAt)}
        </p>
        {post.updatedAt ? (
          <p className="mt-1 text-xs text-slate-300">Last Updated: {formatDate(post.updatedAt)}</p>
        ) : null}
        <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{post.description}</p>
        {post.image ? <BlogMdxImage src={post.image} alt={post.title} width={1600} height={900} /> : null}

        <div className="mt-7 space-y-4 text-[15px] leading-7 text-slate-200 sm:mt-8 sm:leading-8 [&_a]:font-medium [&_a]:text-emerald-300 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-emerald-200 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-400/70 [&_blockquote]:bg-emerald-500/5 [&_blockquote]:px-3 [&_blockquote]:py-2.5 sm:[&_blockquote]:px-4 sm:[&_blockquote]:py-3 [&_h2]:mt-8 [&_h2]:border-t [&_h2]:border-slate-700/80 [&_h2]:pt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-50 sm:[&_h2]:mt-10 sm:[&_h2]:pt-5 sm:[&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-100 sm:[&_h3]:mt-8 sm:[&_h3]:text-lg [&_li]:my-1.5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 sm:[&_ol]:my-4 sm:[&_ol]:pl-6 [&_p]:text-slate-200 [&_strong]:text-slate-50 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 sm:[&_ul]:my-4 sm:[&_ul]:pl-6">
          {post.content}
        </div>

        {postNeedsPaphosCta(post) ? (
          <aside className="mt-10 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4">
            <p className="text-sm text-emerald-100">
              Looking for a professional in Paphos? Browse our verified list here.
            </p>
            <PendingLink
              href="/finder/paphos"
              className="mt-3 inline-flex rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Browse Paphos Professionals
            </PendingLink>
          </aside>
        ) : null}
      </article>
    </main>
  );
}

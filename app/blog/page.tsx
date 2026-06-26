import type { Metadata } from "next";
import { BLOG_SHARE_OG_IMAGE_PATH, getAllBlogPostMeta } from "@/lib/blog";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { MarketingFooter } from "@/components/navigation/MarketingFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
const siteBase = siteUrl.replace(/\/+$/, "");
const blogShareImage = `${siteBase}${BLOG_SHARE_OG_IMAGE_PATH}`;

export const metadata: Metadata = {
  title: "DocCy Blog | Healthcare Guides in Cyprus",
  description:
    "Practical healthcare guides for Cyprus, including GeSY and private care decisions.",
  openGraph: {
    type: "website",
    title: "DocCy Blog | Healthcare Guides in Cyprus",
    description:
      "Practical healthcare guides for Cyprus, including GeSY and private care decisions.",
    url: `${siteBase}/blog`,
    images: [{ url: blogShareImage, alt: "DocCy Blog — Healthcare guides for Cyprus" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DocCy Blog | Healthcare Guides in Cyprus",
    description:
      "Practical healthcare guides for Cyprus, including GeSY and private care decisions.",
    images: [blogShareImage],
  },
};

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function BlogIndexPage() {
  const posts = await getAllBlogPostMeta();

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-8 text-ink-800 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <PendingLink href="/finder" className="inline-flex items-baseline hover:opacity-90">
            <DocCyWordmark variant="light" size="lg" />
          </PendingLink>
          <span className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">Blog</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
          Practical guides to help patients choose healthcare options in Cyprus.
        </p>

        <section className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-clinical-200 bg-white p-4 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_4px_16px_rgba(11,123,181,0.05)] sm:p-5"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-clinical-600">
                {formatDate(post.publishedAt)}
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-ink-900 sm:text-xl">
                <PendingLink href={`/blog/${post.slug}`} className="hover:text-clinical-600">
                  {post.title}
                </PendingLink>
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">{post.description}</p>
            </article>
          ))}
          {posts.length === 0 ? (
            <p className="rounded-xl border border-ink-200 bg-white p-4 text-sm text-ink-500">
              No blog posts yet. Add an `.mdx` file inside `content/blog`.
            </p>
          ) : null}
        </section>
      </div>
      <MarketingFooter variant="light" className="mx-auto mt-6 w-full max-w-6xl pb-24 pt-2 sm:pb-16 lg:pb-12" />
    </main>
  );
}

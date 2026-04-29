import type { Metadata } from "next";
import { getAllBlogPostMeta } from "@/lib/blog";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";

export const metadata: Metadata = {
  title: "DocCy Blog | Healthcare Guides in Cyprus",
  description:
    "Practical healthcare guides for Cyprus, including GeSY and private care decisions.",
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          <PendingLink href="/finder" className="inline-flex items-baseline hover:opacity-90">
            <DocCyWordmark className="!text-2xl sm:!text-3xl" />
          </PendingLink>
          <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Blog</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Practical guides to help patients choose healthcare options in Cyprus.
        </p>

        <section className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-emerald-300/20 bg-slate-900/70 p-4 shadow-[0_0_18px_-12px_rgba(52,211,153,0.6)] sm:p-5"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300/90">
                {formatDate(post.publishedAt)}
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-50 sm:text-xl">
                <PendingLink href={`/blog/${post.slug}`} className="hover:text-emerald-300">
                  {post.title}
                </PendingLink>
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{post.description}</p>
            </article>
          ))}
          {posts.length === 0 ? (
            <p className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
              No blog posts yet. Add an `.mdx` file inside `content/blog`.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

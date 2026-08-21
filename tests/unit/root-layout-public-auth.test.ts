import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("root layout does not block public HTML", () => {
  it("does not call Auth, cookies(), headers(), or getMessages() in app/layout.tsx", () => {
    const source = fs.readFileSync(path.join(repoRoot, "app/layout.tsx"), "utf8");
    assert.equal(source.includes("createServerComponentClient"), false);
    assert.equal(source.includes("getUser("), false);
    assert.equal(source.includes("getMessages"), false);
    assert.equal(source.includes("NextIntlClientProvider"), false);
    assert.equal(source.includes("next/headers"), false);
    assert.equal(source.includes('next/dynamic'), true);
    assert.equal(source.includes("ssr: false"), true);
    assert.equal(source.includes("Suspense"), true);
    assert.equal(
      /<Suspense[\s\S]*<NavigationProgressBar/.test(source),
      true,
      "useSearchParams in NavigationProgressBar must be under Suspense or static pages fail prerender",
    );
    assert.equal(source.includes("GoogleAdsTag"), true);
    assert.equal(source.includes("proChromeBootInlineScript"), true);
    assert.equal(source.includes("ProChromeBoot"), true);
  });

  it("only refreshes Supabase session when needsSupabaseSessionMiddleware is true", () => {
    const source = fs.readFileSync(path.join(repoRoot, "middleware.ts"), "utf8");
    assert.equal(source.includes("needsSupabaseSessionMiddleware"), true);
    assert.equal(source.includes("await supabase.auth.getSession()"), true);
    const sessionCallIndex = source.indexOf("await supabase.auth.getSession()");
    const gateIndex = source.lastIndexOf("needsSupabaseSessionMiddleware(pathname)", sessionCallIndex);
    assert.ok(gateIndex >= 0 && gateIndex < sessionCallIndex);
  });

  it("does not Set-Cookie on the HTML middleware response", () => {
    const source = fs.readFileSync(path.join(repoRoot, "middleware.ts"), "utf8");
    assert.equal(source.includes("res.cookies.set"), false);
  });

  it("does not statically import the browser Supabase client in DoctorSessionProvider", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/navigation/DoctorSessionProvider.tsx"),
      "utf8",
    );
    assert.equal(/from ["']@supabase\/auth-helpers-nextjs["']/.test(source), false);
    assert.equal(source.includes('import("@supabase/auth-helpers-nextjs")'), true);
    assert.equal(source.includes("needsSupabaseSessionMiddleware"), true);
    assert.equal(source.includes("hasBrowserAuthHint"), true);
    assert.equal(source.includes("isProfessionalMarketingPath"), true);
    assert.equal(source.includes("useLayoutEffect"), true);
  });
});

describe("PendingLink does not bail out static prerender", () => {
  it("wraps useSearchParams usage in Suspense", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "components/navigation/PendingLink.tsx"),
      "utf8",
    );
    assert.equal(source.includes("Suspense"), true);
    assert.equal(
      /<Suspense[\s\S]*PendingLinkWithSearchParams/.test(source),
      true,
      "PendingLink must Suspense-wrap the useSearchParams hook or /blog and /terms fail prerender",
    );
  });
});

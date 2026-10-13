import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { loadProfileShareCard } from "@/lib/public/load-profile-share-card";
import {
  PROFILE_SHARE_CARD_SIZE,
  isValidShareCardSlug,
  profileShareCardPath,
  profileShareCardVersion,
  shareCardSpecialtyLine,
} from "@/lib/public/profile-share-card";
import { PROFILE_ACCENT } from "@/lib/profile-theme";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * The picture under a shared profile link (see lib/public/profile-share-card.ts). GET draws
 * only when `v` is the current version of the card; any other `v` is a short redirect to the
 * current one, so a crawler cannot make the server draw by inventing versions. A drawn card is
 * cached for a year: its address changes when anything on it changes.
 * - 404: no registered professional with that slug.
 */

const FONT_DIR = join(process.cwd(), "assets/fonts/inter");
// Greek is its own family, listed after Inter in the card's font-family: the generator takes a
// missing letter from the next family at the same weight (same-name fonts lose the bold).
const FONT_FILES = [
  { file: "inter-latin-400-normal.woff", name: "Inter", weight: 400 },
  { file: "inter-latin-700-normal.woff", name: "Inter", weight: 700 },
  { file: "inter-greek-400-normal.woff", name: "InterGreek", weight: 400 },
  { file: "inter-greek-700-normal.woff", name: "InterGreek", weight: 700 },
] as const;
const FONT_FAMILY = "Inter, InterGreek";

/** Inter, regular and bold, Latin and Greek (the names can be in Greek); read once per instance. */
let fontsPromise: Promise<Array<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }>> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ file, name, weight }) => ({
      name,
      data: await readFile(join(FONT_DIR, file)),
      weight,
      style: "normal" as const,
    })),
  );
  return fontsPromise;
}

const MAX_AVATAR_BYTES = 6 * 1024 * 1024;
const AVATAR_TIMEOUT_MS = 4000;

/** The photo as a small JPEG (any stored format; a big upload stays cheap), or null. */
async function avatarDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS) });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_AVATAR_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_AVATAR_BYTES) return null;
    const jpeg = await sharp(bytes)
      .rotate()
      .resize(420, 540, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^(dr|prof)\.?$/i.test(w));
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function Star({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill={color}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
    </svg>
  );
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!isValidShareCardSlug(slug)) return new NextResponse("Not found", { status: 404 });

  const supabase = createServiceRoleClient();
  if (!supabase) return new NextResponse("Temporarily unavailable", { status: 503 });

  const card = await loadProfileShareCard(supabase, slug);
  if (!card) return new NextResponse("Not found", { status: 404 });

  const version = profileShareCardVersion(card.facts);
  if (req.nextUrl.searchParams.get("v") !== version) {
    return NextResponse.redirect(new URL(profileShareCardPath(slug, version), req.nextUrl.origin), {
      status: 307,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const { facts } = card;
  const palette = PROFILE_ACCENT;
  const photo = await avatarDataUri(card.avatarUrl);
  const specialties = shareCardSpecialtyLine(facts.specialties);
  const { width, height } = PROFILE_SHARE_CARD_SIZE;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          padding: 56,
          background: palette.hero,
          color: palette.onHero,
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            width: 420,
            height: 540,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 44,
            overflow: "hidden",
            background: palette.avatar,
            fontSize: 150,
            fontWeight: 700,
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={420} height={540} style={{ objectFit: "cover" }} alt="" />
          ) : (
            initials(facts.name)
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 56, height: 540, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: facts.name.length > 22 ? 62 : 76, fontWeight: 700, lineHeight: 1.05, display: "flex" }}>
              {facts.name}
            </div>
            {specialties ? (
              <div style={{ marginTop: 24, fontSize: 40, fontWeight: 700, lineHeight: 1.2, display: "flex" }}>{specialties}</div>
            ) : null}
            {facts.district ? (
              <div style={{ marginTop: 16, fontSize: 36, display: "flex", opacity: 0.9 }}>{facts.district}</div>
            ) : null}
            {facts.rating ? (
              <div style={{ marginTop: 34, display: "flex", alignItems: "center" }}>
                <Star color={palette.onHero} />
                <div style={{ marginLeft: 12, fontSize: 52, fontWeight: 700, display: "flex" }}>{facts.rating.average.toFixed(1)}</div>
                <div style={{ marginLeft: 14, fontSize: 34, display: "flex", opacity: 0.9 }}>
                  {`(${facts.rating.count} reviews)`}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                padding: "16px 30px",
                borderRadius: 999,
                background: palette.onHero,
                color: palette.hero,
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              Book online
            </div>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>mydoccy.com</div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: await loadFonts(),
      headers: { "Cache-Control": "public, max-age=31536000, immutable, no-transform" },
    },
  );
}

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { contrastRatio, PROFILE_SURFACES } from "../../lib/profile-theme";
import { SITE_COLOURS, siteColourVar, tailwindSiteColours } from "../../lib/site-theme";
import tailwindConfig from "../../tailwind.config";

const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const HEX = /^#[0-9A-F]{6}$/;
const AA_TEXT = 4.5;
const AA_LARGE = 3;

type Palette = Record<string, string | Record<string, string>>;
const palette = (tailwindConfig.theme?.extend?.colors ?? {}) as Palette;

/** `ink-900` → the Tailwind palette's hex for that shade (`white` → #FFFFFF). */
function tailwindHex(key: string): string {
  if (key === "white") return "#FFFFFF";
  const [name, shade] = key.split("-");
  const scale = palette[name];
  assert.ok(scale && typeof scale === "object", `no Tailwind palette "${name}"`);
  return (scale as Record<string, string>)[shade].toUpperCase();
}

describe("public site colours (Finder, Clinics, profiles): light and dark", () => {
  it("defines every colour as an upper-case hex", () => {
    for (const [group, tokens] of Object.entries(SITE_COLOURS)) {
      for (const [key, { light, dark }] of Object.entries(tokens)) {
        assert.match(light, HEX, `${group}.${key}.light`);
        assert.match(dark, HEX, `${group}.${key}.dark`);
      }
    }
  });

  it("keeps light mode exactly as it was: each light value is the Tailwind shade it replaces", () => {
    for (const tokens of Object.values(SITE_COLOURS)) {
      for (const [key, { light }] of Object.entries(tokens)) {
        const slate: Record<string, string> = { "slate-500": "#64748B", "slate-600": "#475569", "slate-900": "#0F172A" };
        assert.equal(light, slate[key] ?? tailwindHex(key), key);
      }
    }
  });

  it("dark mode is the public profile's palette: navy page, lighter cards", () => {
    assert.equal(SITE_COLOURS.background["ink-50"].dark, PROFILE_SURFACES.dark.bg);
    assert.equal(SITE_COLOURS.background.white.dark, PROFILE_SURFACES.dark.surface);
    assert.equal(SITE_COLOURS.border["ink-200"].dark, PROFILE_SURFACES.dark.border);
    assert.equal(SITE_COLOURS.text["ink-900"].dark, PROFILE_SURFACES.dark.text);
  });

  it("keeps every dark text colour readable (WCAG AA) on every dark surface", () => {
    for (const [textKey, { dark: fg }] of Object.entries(SITE_COLOURS.text)) {
      // ink-400 is for placeholders and decoration only: large-text contrast is enough.
      const min = textKey === "ink-400" ? AA_LARGE : AA_TEXT;
      for (const [bgKey, { dark: bg }] of Object.entries(SITE_COLOURS.background)) {
        const ratio = contrastRatio(fg, bg);
        assert.ok(ratio >= min, `text ${textKey} on ${bgKey}: ${ratio.toFixed(2)} < ${min}`);
      }
    }
  });

  it("Tailwind reads each colour from a variable, with the light value as the fallback", () => {
    const extend = tailwindConfig.theme?.extend ?? {};
    const groups = {
      background: extend.backgroundColor,
      text: extend.textColor,
      border: extend.borderColor,
      ringOffset: extend.ringOffsetColor,
    } as Record<string, unknown>;
    for (const group of Object.keys(SITE_COLOURS) as Array<keyof typeof SITE_COLOURS>) {
      assert.deepEqual((groups[group] as { site?: unknown })?.site, tailwindSiteColours(group), group);
      for (const [key, { light }] of Object.entries(SITE_COLOURS[group])) {
        assert.equal(tailwindSiteColours(group)[key], `var(${siteColourVar(group, key)}, ${light})`);
      }
    }
  });

  it("globals.css switches every colour to its dark value on a dark page", () => {
    const css = read("app/globals.css");
    const block = css.match(/\.doccy-profile\[data-scheme="dark"\]\s*\{([^}]*)\}/g)?.join("\n") ?? "";
    for (const group of Object.keys(SITE_COLOURS) as Array<keyof typeof SITE_COLOURS>) {
      for (const [key, { dark }] of Object.entries(SITE_COLOURS[group])) {
        assert.match(block, new RegExp(`${siteColourVar(group, key)}:\\s*${dark};`, "i"), `${group}.${key}`);
      }
    }
  });
});

// The colour classes that have a site colour instead. Classes with an opacity (`bg-white/10`)
// sit on the teal or navy panels, which look the same in both modes, and stay as they are.
const FIXED_COLOUR =
  /(?<![\w-])(bg-(white|ink-(50|100)|clinical-(50|100))|text-(ink-[4-9]00|clinical-[5-8]00|slate-[5-9]00)|border-(ink-(100|200)|clinical-[2-4]00)|divide-ink-100|ring-offset-ink-50)(?![\w/-])/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("Finder and Clinics use the site colours", () => {
  it("has no fixed light-only colour class left in the Finder, Clinics and their components", () => {
    const files = [...sourceFiles("app/finder"), ...sourceFiles("app/clinics"), ...sourceFiles("components/finder")];
    assert.ok(files.length > 30);
    const left = files.flatMap((file) =>
      [...read(file).matchAll(FIXED_COLOUR)].map((match) => `${file}: ${match[0]}`),
    );
    assert.deepEqual(left, []);
  });
});

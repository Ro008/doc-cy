/**
 * JSON for a `<script type="application/ld+json">` written with dangerouslySetInnerHTML.
 * Escapes `<` so no text (a professional's name, services, clinic names…) can close the
 * script tag and run its own code; the JSON itself is unchanged (`<` parses back to `<`).
 */
export function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

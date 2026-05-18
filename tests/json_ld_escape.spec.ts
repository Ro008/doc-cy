import { expect, test } from "@playwright/test";

import { stringifyJsonLd } from "@/lib/json-ld";

test.describe("JSON-LD serialization", () => {
  test("escapes script-breaking payloads while preserving parseable JSON", () => {
    const serialized = stringifyJsonLd({
      description: '</script><script>window.__doccyXss = true</script>',
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script>");

    const parsed = JSON.parse(serialized) as { description: string };
    expect(parsed.description).toBe(
      '</script><script>window.__doccyXss = true</script>',
    );
  });
});

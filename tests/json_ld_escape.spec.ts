import { expect, test } from "@playwright/test";

import { stringifyJsonLd } from "@/lib/json-ld";

test.describe("JSON-LD serialization", () => {
  test("escapes script-breaking less-than characters", () => {
    const serialized = stringifyJsonLd({
      "@context": "https://schema.org",
      "@type": "Physician",
      name: 'Dr Example </script><img src=x onerror="alert(1)">',
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
    expect(JSON.parse(serialized)).toMatchObject({
      name: 'Dr Example </script><img src=x onerror="alert(1)">',
    });
  });
});

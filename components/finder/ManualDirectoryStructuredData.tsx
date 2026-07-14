type ManualDirectoryStructuredDataProps = {
  siteUrl: string;
  pageUrl: string;
  name: string;
  specialty: string;
  district: string;
  phone?: string | null;
  mapsUrl: string;
};

function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function ManualDirectoryStructuredData({
  siteUrl,
  pageUrl,
  name,
  specialty,
  district,
  phone,
  mapsUrl,
}: ManualDirectoryStructuredDataProps) {
  const tel = String(phone ?? "").trim();
  const payload = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "@id": `${pageUrl}#physician`,
    name,
    medicalSpecialty: specialty,
    url: pageUrl,
    sameAs: mapsUrl,
    address: {
      "@type": "PostalAddress",
      addressLocality: district,
      addressCountry: "CY",
    },
    ...(tel ? { telephone: tel } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: "DocCy",
      url: siteUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: stringifyJsonLd(payload) }}
    />
  );
}

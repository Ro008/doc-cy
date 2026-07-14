type ManualDirectoryStructuredDataProps = {
  siteUrl: string;
  pageUrl: string;
  name: string;
  specialty: string;
  district: string;
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
  mapsUrl,
}: ManualDirectoryStructuredDataProps) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": `${pageUrl}#professional`,
    name,
    medicalSpecialty: specialty,
    url: pageUrl,
    sameAs: mapsUrl,
    address: {
      "@type": "PostalAddress",
      addressLocality: district,
      addressCountry: "CY",
    },
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

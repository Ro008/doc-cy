type FinderStructuredDataEntry = {
  name: string;
  specialty: string | null;
  district: string | null;
  profileUrl: string | null;
  mapsUrl: string | null;
};

type FinderStructuredDataProps = {
  siteUrl: string;
  finderPath: string;
  entries: FinderStructuredDataEntry[];
  activeDistrict: string;
  activeSpecialty: string;
};

function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function FinderStructuredData({
  siteUrl,
  finderPath,
  entries,
  activeDistrict,
  activeSpecialty,
}: FinderStructuredDataProps) {
  const physicianEntries = entries.map((entry, index) => {
    const locality = (entry.district ?? "").trim() || "Cyprus";
    const specialty = (entry.specialty ?? "").trim() || "General Practice";
    const canonicalUrl =
      (entry.profileUrl ?? "").trim() || (entry.mapsUrl ?? "").trim() || `${siteUrl}${finderPath}`;

    return {
      "@context": "https://schema.org",
      "@type": "Physician",
      "@id": `${canonicalUrl}#physician-${index + 1}`,
      name: entry.name,
      medicalSpecialty: specialty,
      address: {
        "@type": "PostalAddress",
        addressLocality: locality,
        addressCountry: "CY",
      },
      url: canonicalUrl,
    };
  });

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "DocCy Health Finder results",
    numberOfItems: physicianEntries.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: physicianEntries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: entry.url,
      item: {
        "@type": "Physician",
        name: entry.name,
        medicalSpecialty: entry.medicalSpecialty,
      },
    })),
  };

  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: `${siteUrl}/`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Find a Professional",
      item: `${siteUrl}/finder`,
    },
    ...(activeDistrict
      ? [
          {
            "@type": "ListItem",
            position: 3,
            name: activeDistrict,
            item: `${siteUrl}/finder/${finderPath.split("/")[2] ?? ""}`,
          },
        ]
      : []),
    ...(activeDistrict && activeSpecialty
      ? [
          {
            "@type": "ListItem",
            position: 4,
            name: activeSpecialty,
            item: `${siteUrl}${finderPath}`,
          },
        ]
      : []),
  ];

  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return (
    <>
      {physicianEntries.map((entry, index) => (
        <script
          key={`finder-physician-jsonld-${index + 1}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(entry) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(itemList) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbList) }}
      />
    </>
  );
}


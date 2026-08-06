/** @type {import('next').NextConfig} */
import createNextIntlPlugin from "next-intl/plugin";

const remotePatterns = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
    pathname: "/**",
  },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/public/**",
    });
  } catch {
    // Ignore malformed env; app can still run with default image hosts.
  }
}

const nextConfig = {
  // Avoid Dropbox locks on the default ".next/trace" path in Windows.
  distDir: process.platform === "win32" ? ".next-local" : ".next",
  images: {
    remotePatterns,
  },
  async redirects() {
    return [
      {
        source: "/blog/gesy-tax-trap-opting-out-cost-you-thousands-later",
        destination: "/blog/gesy-tax-trap-cyprus-expats",
        permanent: true,
      },
      {
        source: "/blog/sick-at-10pm-duty-pharmacies-paphos-limassol",
        destination: "/blog/sick-at-10pm-duty-pharmacies-paphos",
        permanent: true,
      },
      // Patient finder is now the homepage; keep /finder/professional|clinic as-is.
      {
        source: "/finder",
        destination: "/",
        permanent: true,
      },
      {
        source: "/finder/:district(nicosia|limassol|paphos|larnaca|famagusta|all)",
        destination: "/:district",
        permanent: true,
      },
      {
        source: "/finder/:district(nicosia|limassol|paphos|larnaca|famagusta|all)/:specialty*",
        destination: "/:district/:specialty*",
        permanent: true,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

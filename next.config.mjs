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
  images: {
    remotePatterns,
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

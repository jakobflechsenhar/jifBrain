import type { NextConfig } from "next";

// Extract hostname from the Supabase URL env var rather than hardcoding the project ID
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : '';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
          },
        ]
      : [],
  },
};

export default nextConfig;

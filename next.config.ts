import type { NextConfig } from "next";

const r2PublicUrl =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
const r2Hostname = r2PublicUrl ? new URL(r2PublicUrl).hostname : null;
const rawBuildId =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_APP_BUILD_ID ||
  Date.now().toString();
const appBuildId = rawBuildId.replace(/[^a-zA-Z0-9-_]/g, "") || "dev";

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: appBuildId,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      ...(r2Hostname
        ? [
            {
              protocol: "https" as const,
              hostname: r2Hostname,
              pathname: "/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      }
    ],
  },
  transpilePackages: ["@radix-ui/react-label", "@radix-ui/react-primitive"],

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  generateBuildId: async () => appBuildId,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

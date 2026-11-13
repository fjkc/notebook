import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @repo/backend ships TypeScript source; Next compiles it (backend/README.md).
  transpilePackages: ["@repo/backend"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

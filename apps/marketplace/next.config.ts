import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image uses the self-contained server; `next start` needs the regular output
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;

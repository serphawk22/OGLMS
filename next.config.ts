import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Strict Mode to prevent WebGL double-mount crashes in dev
  reactStrictMode: false,
};

export default nextConfig;

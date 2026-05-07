import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Strict Mode to prevent WebGL double-mount crashes in dev
  reactStrictMode: false,
  // Don't bundle native Node modules — require them at runtime on the server only
  serverExternalPackages: ["pdf-parse", "pg", "@prisma/adapter-pg", "bcryptjs", "@prisma/client"],
};

export default nextConfig;

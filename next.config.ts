import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export statique pour Capacitor (APK Android)
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

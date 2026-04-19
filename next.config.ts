import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",   // Generates static files in out/ for Firebase Hosting
  images: {
    unoptimized: true, // Required for static export (no Next.js image server)
  },
};

export default nextConfig;

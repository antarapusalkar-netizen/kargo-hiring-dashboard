import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) and mammoth do dynamic/conditional requires that
  // break when webpack/Turbopack tries to bundle them into the serverless
  // function — keep them as real node_modules requires at runtime instead.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow cross-origin requests from the FastAPI dev server in Next.js devtools
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;

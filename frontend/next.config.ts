import type { NextConfig } from "next";

const isMobile = process.env.BUILD_TARGET === "mobile";

const nextConfig: NextConfig = {
  ...(isMobile
    ? {
        output: "export",
        trailingSlash: true,
      }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/:path*`,
            },
          ];
        },
      }),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

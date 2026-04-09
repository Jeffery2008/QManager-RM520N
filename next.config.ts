import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  trailingSlash: true,

  // Uncomment for local dev. Comment out before `bun run build` (static export).
  async rewrites() {
    return [
      {
        source: "/cgi-bin/:path*",
        // HTTPS — must match lighttpd (it redirects HTTP→HTTPS, breaking cookies).
        // Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 bun dev
        destination: "https://192.168.225.1/cgi-bin/:path*",
        // Tailscale alternative:
        // destination: "https://toothless.tail23767.ts.net/cgi-bin/:path*",
        basePath: false,
      },
    ];
  },

};

export default nextConfig;

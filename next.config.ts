import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  
  // This block will be commented out before running bun run build and only used in development to proxy API requests to the modem's web server.
    async rewrites() {
    return [
      {
        source: '/cgi-bin/:path*',
        destination: 'http://192.168.224.1/cgi-bin/:path*',
        basePath: false,
      },
    ];
  },
};

export default nextConfig;

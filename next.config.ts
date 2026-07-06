import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  
  // 📦 Avisa a Vercel para mandar o banco de dados pro servidor do jeito certo
  serverExternalPackages: ['duckdb'],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", port: "", pathname: "/storage/v1/object/public/**" },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/lemmit-bypass/:path*', destination: 'https://api.lemit.com.br/api/v1/consulta/:path*' },
    ];
  },
};

export default nextConfig;
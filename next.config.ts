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

  // 🌐 Injeção de Headers Globais para limpar o cache de Preflight do navegador
  async headers() {
    return [
      {
        // Aplica as regras de liberação em todas as rotas de API do projeto
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/api/lemmit-bypass/:path*', destination: 'https://api.lemit.com.br/api/v1/consulta/:path*' },
    ];
  },
};

export default nextConfig;
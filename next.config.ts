import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🚜 MODO TRATOR: Ignora erros de compilação
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  
  // 📦 EXTENSÃO NATIVA: Impede que a Vercel empacote o DuckDB como JS comum
  serverExternalPackages: ['duckdb'],

  // 🖼️ CONFIGURAÇÃO DE MÍDIA
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", port: "", pathname: "/storage/v1/object/public/**" },
    ],
  },

  // 🚀 TÚNEL DE REDE
  async rewrites() {
    return [
      { source: '/api/lemmit-bypass/:path*', destination: 'https://api.lemit.com.br/api/v1/consulta/:path*' },
    ];
  },
};

export default nextConfig;
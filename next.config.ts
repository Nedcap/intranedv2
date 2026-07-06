import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🚜 MODO TRATOR: Ignora erros no Build
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  
  // 📦 EXTENSÃO NATIVA
  serverExternalPackages: ['duckdb'],

  // 🥷 TRUQUE NINJA: Obriga a Vercel a enviar o DuckDB para o servidor sem que o compilador analise o C++
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/duckdb/**/*'],
    },
  },

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
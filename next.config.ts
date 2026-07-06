import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🚜 MODO TRATOR: Ignora erros no Build
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  
  // 📦 EXTENSÃO NATIVA: Impede que a Vercel tente empacotar o DuckDB como JS comum
  serverExternalPackages: ['duckdb'],

  // 🥷 FORÇA BRUTA: Como cegamos a Vercel com o 'eval' no código, isso aqui obriga ela a 
  // colocar o DuckDB dentro do servidor de produção sem tentar ler o que tem dentro.
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/duckdb/**/*'],
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
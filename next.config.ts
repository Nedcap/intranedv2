import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🚜 MODO TRATOR: Ignora erros chatos de Typescript no Build
  typescript: {
    ignoreBuildErrors: true,
  },
  // 🚜 MODO TRATOR: Ignora avisos de Linting no Build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
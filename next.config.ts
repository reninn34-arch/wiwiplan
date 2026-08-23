import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp trae binarios nativos: se carga en tiempo de ejecución, no se empaqueta.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp trae binarios nativos: se carga en tiempo de ejecución, no se empaqueta.
  serverExternalPackages: ["sharp"],
  // El tracer no incluye las optional deps de segundo nivel de sharp y el
  // deploy llegaba sin libvips-cpp.so (ERR_DLOPEN_FAILED al editar ideas).
  // Las claves van con picomatch: los corchetes de rutas dinámicas se escapan.
  outputFileTracingIncludes: {
    "/api/clients": ["./node_modules/@img/sharp-linux-x64/**", "./node_modules/@img/sharp-libvips-linux-x64/**"],
    "/api/clients/\\[id\\]": ["./node_modules/@img/sharp-linux-x64/**", "./node_modules/@img/sharp-libvips-linux-x64/**"],
    "/api/plannings/\\[id\\]/ideas": ["./node_modules/@img/sharp-linux-x64/**", "./node_modules/@img/sharp-libvips-linux-x64/**"],
    "/api/plannings/\\[id\\]/ideas/\\[ideaId\\]": ["./node_modules/@img/sharp-linux-x64/**", "./node_modules/@img/sharp-libvips-linux-x64/**"],
    "/api/plannings/\\[id\\]/storyboard/\\[panelId\\]": ["./node_modules/@img/sharp-linux-x64/**", "./node_modules/@img/sharp-libvips-linux-x64/**"],
  },
};

export default nextConfig;

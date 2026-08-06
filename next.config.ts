import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Padrão do Next é 1 MB -- foto de anexo (Peças, SAC, montador,
      // motorista) permite até 10 MB (ver MAX_FILE_SIZE_BYTES em
      // servicePhotos.ts), e HEIC de celular quase sempre passa de 1 MB.
      // Sem isso, o upload falhava antes até de chegar no código, com um
      // erro genérico ("an unexpected response was received from the
      // server") que não dizia nada sobre tamanho de arquivo.
      bodySizeLimit: "11mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Sem authToken configurado: o upload de source maps é pulado (só warning
  // no build), o monitoramento de erro em si funciona normalmente.
});

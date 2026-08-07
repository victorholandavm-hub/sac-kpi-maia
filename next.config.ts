import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // As instâncias sac-ip/assistencia-ip da VPS servem sob prefixo de path
  // (/apps/sac, /apps/ -- ver server block default_server do nginx, é o
  // fallback de acesso direto por IP). sac/assistencia (domínio próprio)
  // não setam essa env var, então basePath fica undefined pra elas -- sem
  // isso aqui, alguém tinha editado esse arquivo direto na VPS pra essas
  // duas instâncias, sem nunca commitar, e qualquer commit futuro que
  // tocasse nesse arquivo travava o `git pull` do deploy nelas (silenciosamente:
  // o pm2 restart rodava mesmo assim, com o código antigo).
  basePath: process.env.NEXT_BASE_PATH || undefined,
  experimental: {
    serverActions: {
      // Padrão do Next é 1 MB -- foto de anexo (Peças, SAC, montador,
      // motorista) permite até 10 MB (ver MAX_FILE_SIZE_BYTES em
      // servicePhotos.ts), e HEIC/JPEG de celular quase sempre passa de
      // 1 MB. Margem de 5 MB acima do limite de 10 MB do app de propósito
      // (não só o mínimo pro overhead do multipart): sem essa folga, um
      // arquivo um pouco acima de 10 MB batia direto no limite do Next
      // antes de chegar na validação com mensagem clara ("foto grande
      // demais, máximo 10 MB") -- caía de novo no erro genérico ("an
      // unexpected response was received from the server").
      bodySizeLimit: "15mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Sem authToken configurado: o upload de source maps é pulado (só warning
  // no build), o monitoramento de erro em si funciona normalmente.
});

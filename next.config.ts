import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Sem authToken configurado: o upload de source maps é pulado (só warning
  // no build), o monitoramento de erro em si funciona normalmente.
});

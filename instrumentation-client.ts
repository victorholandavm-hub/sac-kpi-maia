import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Sem replaysSessionSampleRate/replaysOnErrorSampleRate de propósito — só
  // de estarem presentes (mesmo com valor 0) o SDK já carrega toda a
  // instrumentação de Replay (observadores de mouse/toque/scroll) o tempo
  // todo, só pra ficar pronta caso precise gravar. Isso travava o scroll de
  // verdade (gesto de mouse/dedo) em alguns navegadores, mesmo com a
  // gravação em si nunca sendo enviada — bug real reproduzido nesse app.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://10fec7c6a14c67e9406d4444545925d5@o4509445712445440.ingest.us.sentry.io/4509445713690624",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  enabled: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',

  // Lazy-load replay: don't initialize replayIntegration here
  integrations: [],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // No continuous recording, only on error
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  // Enable sending user PII (Personally Identifiable Information)
  // Test gpg git commit signature
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

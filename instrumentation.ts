// Temporarily disabled Sentry to speed up builds
// import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Temporarily disabled Sentry initialization
  // if (process.env.NEXT_RUNTIME === 'nodejs') {
  //   await import('./sentry.server.config');
  // }

  // if (process.env.NEXT_RUNTIME === 'edge') {
  //   await import('./sentry.edge.config');
  // }
}

// Temporarily disabled Sentry error capture
// export const onRequestError = Sentry.captureRequestError;

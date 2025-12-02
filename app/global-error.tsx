"use client";

// Temporarily disabled Sentry to speed up builds
// import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
// import { useEffect } from "react";

export default function GlobalError({ error: _error }: { error: Error & { digest?: string } }) {
  // Temporarily disabled Sentry error capture
  // Parameter prefixed with _ to indicate intentionally unused
  // useEffect(() => {
  //   Sentry.captureException(_error);
  // }, [_error]);

  return (
    <html>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
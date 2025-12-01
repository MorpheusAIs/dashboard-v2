// Temporarily disabled Sentry to speed up builds
// import {withSentryConfig} from '@sentry/nextjs';
// import webpack from 'webpack'; // No longer needed without Sentry webpack plugin

const isProd = process.env.VERCEL_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
  },
  // Use hidden source maps so they are not referenced in built JS files
  productionBrowserSourceMaps: false,
  // Ignore specific files/folders during build
  webpack: (config, { dev }) => {
    // Add files/folders to ignore
    config.watchOptions = {
      ignored: ['/DashBoard', '/DashBoard/*']
    }

    // Handle React Native async storage import for MetaMask SDK
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    }

    // Force webpack to use hidden-source-map in production
    if (isProd && !dev) {
      config.devtool = 'hidden-source-map';
    }

    // Temporarily disabled Sentry SDK bloat reduction
    // config.plugins.push(
    //   new webpack.DefinePlugin({
    //     __SENTRY_DEBUG__: false,
    //     __SENTRY_TRACING__: false,
    //   })
    // );

    return config
  },
  // Configure build output directory
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],
};

export default nextConfig;

// Temporarily disabled Sentry config wrapper
// export default withSentryConfig(nextConfig, {
//   // For all available options, see:
//   // https://www.npmjs.com/package/@sentry/webpack-plugin#options
//
//   org: "morpheusai",
//
//   project: "morpheus-dashboard",
//
//   // Only print logs for uploading source maps in CI
//   silent: !process.env.CI,
//
//   // Upload sourcemaps only in production
//   release: {
//     create: isProd,
//   },
//   sourcemaps: {
//     disable: !isProd,
//     deleteSourcemapsAfterUpload: true, // delete after upload to Sentry
//   },
//
//   // Hide them from the public bundle
//   hideSourceMaps: true,
//
//   // Disable plugin outside production
//   disableServerWebpackPlugin: !isProd,
//   disableClientWebpackPlugin: !isProd,
//
//   // Reduce Sentry SDK bloat
//   disableLogger: true,
//   widenClientFileUpload: false,
//   transpileClientSDK: false,
//
//   // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
//   // This can increase your server load as well as your hosting bill.
//   // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
//   // side errors will fail.
//   tunnelRoute: "/monitoring",
//
//   // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
//   // See the following for more information:
//   // https://docs.sentry.io/product/crons/
//   // https://vercel.com/docs/cron-jobs
//   automaticVercelMonitors: true,
// });
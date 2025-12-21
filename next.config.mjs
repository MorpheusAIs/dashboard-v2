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


    return config
  },
  // Configure build output directory
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],
};

export default nextConfig;
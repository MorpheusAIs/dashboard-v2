const isProd = process.env.VERCEL_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  // Allow public/mor-security.jpg + API copy to be fetched/embedded from any other URL/origin
  async headers() {
    return [
      {
        source: '/mor-security.jpg',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          { key: 'Timing-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/assets/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
    ];
  },
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
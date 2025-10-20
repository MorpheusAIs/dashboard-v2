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
  // Ignore specific files/folders during build
  webpack: (config) => {
    // Add files/folders to ignore
    config.watchOptions = {
      ignored: ['/DashBoard', '/DashBoard/*']
    }

    // Handle React Native async storage import for MetaMask SDK
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    }

    return config
  },
  // Configure build output directory
  // Test discord webhook
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],
};

export default nextConfig;

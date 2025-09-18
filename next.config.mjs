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
    return config
  },
  // Configure build output directory
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],
};

export default nextConfig;

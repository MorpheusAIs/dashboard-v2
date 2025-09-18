/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is enabled by default in Next.js 15 for 'next dev'
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
  // Note: Webpack config removed for Turbopack compatibility
  // Turbopack has better file watching and ignoring capabilities built-in
  // If needed, Turbopack-specific configurations can be added via experimental.turbo
  // Configure build output directory
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],
};

export default nextConfig;

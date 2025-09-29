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
  // Configure build output directory
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],
};

export default nextConfig;

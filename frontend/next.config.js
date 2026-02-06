/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['images.clerk.dev', 'img.clerk.com'],
  },
}

module.exports = nextConfig

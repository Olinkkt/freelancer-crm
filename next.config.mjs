/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['*.trycloudflare.com'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig

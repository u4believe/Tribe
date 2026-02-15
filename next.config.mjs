/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['75185ef6-659b-4dab-8643-5f4d58fc7171-00-hgkszn9oeqkr.kirk.replit.dev', '*.kirk.replit.dev', '*.replit.dev'],
}

export default nextConfig

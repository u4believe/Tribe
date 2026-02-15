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
  allowedDevOrigins: ['https://75185ef6-659b-4dab-8643-5f4d58fc7171-00-hgkszn9oeqkr.kirk.replit.dev', 'http://75185ef6-659b-4dab-8643-5f4d58fc7171-00-hgkszn9oeqkr.kirk.replit.dev', 'https://*.replit.dev', 'http://*.replit.dev'],
}

export default nextConfig

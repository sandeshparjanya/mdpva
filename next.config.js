/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost', 'graoxxowiekyqyibrkuv.supabase.co'],
  },
}

module.exports = nextConfig

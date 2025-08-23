/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'graoxxowiekyqyibrkuv.supabase.co'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : []
      config.externals = [
        ...externals,
        '@react-pdf/renderer',
        '@react-pdf/layout',
        '@react-pdf/textkit',
        'bidi-js',
      ]
    }
    return config
  },
}

module.exports = nextConfig

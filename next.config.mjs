/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Increase body size limit (though Vercel may still enforce its own limits)
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
}

export default nextConfig

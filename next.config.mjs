/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/pricing',
        destination: '/dashboard/athlete/upgrade',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

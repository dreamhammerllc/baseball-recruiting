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
        // /pricing now points logged-out visitors at the homepage pricing
        // section instead of bouncing them into the dashboard auth wall.
        // permanent: false (307) so the old permanent 308 doesn't keep
        // sending cached browsers to the dashboard upgrade page.
        source: '/pricing',
        destination: '/#pricing',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'web-push', 'nodemailer'],
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default nextConfig;

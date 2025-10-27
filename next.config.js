/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin', 'mongoose', 'graphql-yoga']
  },
  async rewrites() {
    return [
      { source: '/api/cases', destination: '/api/public/cases' },
      { source: '/api/stores', destination: '/api/public/stores' },
      { source: '/api/uploads', destination: '/api/public/uploads' },
      { source: '/api/checkReplies', destination: '/api/public/checkReplies' }
    ];
  }
};

module.exports = nextConfig;

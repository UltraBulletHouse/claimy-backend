/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin', 'mongoose', 'graphql-yoga']
  }
};

module.exports = nextConfig;

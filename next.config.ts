/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // We run ESLint in our Github Action and local CLI, 
    // disable here to save Vercel build container memory
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We already run type checking before pushes,
    // disable here to prevent silent OOM crashes on Vercel
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

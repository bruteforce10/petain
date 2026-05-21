import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ['@terramap/types', '@terramap/supabase', '@terramap/ui'],
  images: {
    // Tokopedia/Shopee product image hosts are remote; allow any https host.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;

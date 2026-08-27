import type { NextConfig } from 'next';

const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  // A separate static build for GitHub Pages. The existing Vinext build remains
  // the deployment path for the current private site.
  output: process.env.GITHUB_PAGES === 'true' ? 'export' : undefined,
  images: { unoptimized: true },
  basePath,
};

export default nextConfig;

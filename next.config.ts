import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Headless Chromium for the deck PDFs stays outside the bundle
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  // API routes read deck files, and the PDF's form fields embed Inter, at runtime
  outputFileTracingIncludes: {
    '/api/pitch/**': ['./decks/**/*.json', './lib/pitch/fonts/*.ttf'],
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Headless Chromium for the deck PDFs stays outside the bundle
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  // API routes read deck files, and the PDF's form fields embed Inter, at runtime
  outputFileTracingIncludes: {
    '/api/pitch/**': ['./decks/**/*.json', './lib/pitch/fonts/*.ttf'],
    // Tracing follows playwright-core's code but not its data files (browsers.json), or Chromium's binaries
    '/api/pitch/pdf/**': ['./node_modules/playwright-core/**/*', './node_modules/@sparticuz/chromium/**/*'],
  },
  // Experiments became the TALO Viewer
  redirects: async () => [{ source: '/experiments', destination: '/viewer', permanent: false }],
};

export default nextConfig;

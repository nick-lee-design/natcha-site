// Renders the living assembly's assembled state to public/pitch-assets/living-assembly.jpg,
// the image print, thumbnails and the editor show. Needs the dev server running.
// Usage: npm run assembly-still [-- http://localhost:3000]
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const out = new URL('../public/pitch-assets/living-assembly.jpg', import.meta.url);

const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`${base}/pitch/dev/assembly-still`);
const still = await page.waitForSelector('canvas[data-still]').then((el) => el.getAttribute('data-still'));
await browser.close();

if (!still?.startsWith('data:image/jpeg')) throw new Error('WebGL was unavailable, no still rendered');
await writeFile(out, Buffer.from(still.split(',')[1], 'base64'));
console.log(`Wrote ${out.pathname}`);

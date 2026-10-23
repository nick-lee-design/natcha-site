import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { visibleSlides } from '../decks';

const DECK = 'talo-base';
// Anti-aliasing only: at most 0.2% of pixels may differ
const TOLERANCE = 0.002;
const SETTLE = 1200;
// By design these differ: the contact slide's live form becomes a QR card in print, and the
// cover's live 3D assembly becomes its still. Each sits in the same box, so it's masked on
// both sides and the rest still has to match.
const PRINT_VARIANTS = '.d-form-card, .d-assembly';

// If every slide's last build matches its print render, export can never disagree with the animation
test.describe('present at the last build matches print', () => {
  const slides = visibleSlides(DECK);

  for (const [i, slide] of slides.entries()) {
    test(`slide ${i + 1}: ${slide.id}`, async ({ page, browser }) => {
      await page.goto(`/pitch/present/${DECK}#slide-${i + 1}`);
      await page.evaluate(() => document.fonts.ready);
      const stage = page.locator('.pitch-stage');
      const steps = Number(await stage.getAttribute('data-steps'));
      for (let s = 1; s < steps; s++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(60);
      }
      await expect(stage).toHaveAttribute('data-step', String(steps));
      await page.waitForTimeout(SETTLE);
      const present = PNG.sync.read(await page.locator('.deck-canvas').screenshot({ mask: [page.locator(PRINT_VARIANTS)] }));

      const printPage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      await printPage.goto(`/pitch/print/${DECK}`);
      await printPage.waitForSelector('[data-print-ready]');
      const print = PNG.sync.read(
        await printPage.locator('.pitch-page').nth(i).screenshot({ mask: [printPage.locator('.pitch-page').nth(i).locator(PRINT_VARIANTS)] }),
      );
      await printPage.close();

      expect([present.width, present.height]).toEqual([print.width, print.height]);
      const diff = pixelmatch(present.data, print.data, null, present.width, present.height, { threshold: 0.1 });
      expect(diff / (present.width * present.height)).toBeLessThan(TOLERANCE);
    });
  }
});

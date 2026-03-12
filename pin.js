/**
 * Pinterest Browser-Based Pinner
 *
 * Usage: node pin.js
 *
 * Pins Etsy listings to Pinterest using the browser (no API key required).
 * Uses Pinterest's pin/create/button URL with your logged-in browser session.
 * Resume-capable via progress file.
 *
 * Prerequisites:
 *   - Browser running with --remote-debugging-port (set DEBUG_PORT in .env)
 *   - Logged in to Pinterest in the browser
 *   - listings_with_images.json (run pinterest_scrape.js first)
 */

require('dotenv/config');
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync, exec } = require('child_process');

const BROWSER_EXE = process.env.BROWSER_EXE;
const USER_DATA = process.env.BROWSER_USER_DATA;
const DEBUG_PORT = parseInt(process.env.DEBUG_PORT || '9333');
const PROGRESS_FILE = './pin_progress.json';
const DATA_FILE = './listings_with_images.json';

function shortTitle(original) {
  if (!original) return '';
  // Remove common apparel keywords to make the pin title cleaner
  const removeWords = [
    'Graphic Tee', 'Graphic T-Shirt', 'T-Shirt', 'Tee Shirt', 'Tee,',
    'Sweatshirt', 'Hoodie', 'Hooded Sweatshirt', 'Crewneck',
    'Unisex', 'Mens', 'Womens', "Men's", "Women's",
    'Gift For Her', 'Gift For Him', 'Gift Idea', 'Birthday Gift',
    'Trendy', 'Aesthetic', 'Oversized', 'Comfort Colors',
    'DTF Print', 'Screen Print',
  ];
  let t = original;
  for (const w of removeWords) {
    t = t.replace(new RegExp(w, 'gi'), '');
  }
  t = t.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').replace(/,\s*$/, '').replace(/^\s*,/, '').trim();
  if (t.length > 50) {
    const parts = t.split(',').map(s => s.trim());
    let result = '';
    for (const part of parts) {
      const next = result ? result + ', ' + part : part;
      if (next.length <= 50) result = next;
      else break;
    }
    t = result || t.substring(0, 50).trim();
  }
  if (t.length > 50) t = t.substring(0, 47).trim() + '...';
  return t;
}

(async () => {
  console.log('\nPinterest Browser Pinner\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('No listing data found. Run pinterest_scrape.js first.');
    process.exit(1);
  }

  let progress;
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } else {
    progress = { pinned: [], lastUpdated: null };
  }

  const listings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const pinnedIds = new Set(progress.pinned.map(p => p.id));
  const toPin = listings.filter(l => l.imageUrl && !pinnedIds.has(l.id));

  console.log(`  Total: ${listings.length} | Already pinned: ${progress.pinned.length} | Remaining: ${toPin.length}\n`);
  if (toPin.length === 0) { console.log('All listings already pinned!'); return; }

  // Start browser
  if (BROWSER_EXE && USER_DATA) {
    console.log('Starting browser...');
    try { execSync('taskkill /F /IM opera.exe /T', { stdio: 'ignore' }); } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
    exec(`"${BROWSER_EXE}" --remote-debugging-port=${DEBUG_PORT} --user-data-dir="${USER_DATA}" --no-first-run --start-maximized`);
    await new Promise(r => setTimeout(r, 5000));
  }

  let browser;
  for (let i = 0; i < 15; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
      console.log('Connected!\n');
      break;
    } catch (e) {
      console.log(`   Attempt ${i + 1}/15...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!browser) { console.log('Could not connect to browser!'); process.exit(1); }

  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();

  for (let i = 0; i < toPin.length; i++) {
    const listing = toPin[i];
    console.log(`\n[${i + 1}/${toPin.length}] ${listing.id} — Pinterest pin`);

    try {
      // Check connection
      try {
        await page.evaluate(() => document.title);
      } catch (e) {
        console.log('  Reconnecting...');
        try { await browser.close(); } catch (e2) {}
        await new Promise(r => setTimeout(r, 3000));
        for (let retry = 0; retry < 10; retry++) {
          try {
            browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
            break;
          } catch (e3) { await new Promise(r => setTimeout(r, 2000)); }
        }
        const ctx = browser.contexts()[0];
        page = ctx.pages()[0] || await ctx.newPage();
      }

      const etsyUrl = listing.listingUrl || `https://www.etsy.com/listing/${listing.id}`;

      // Visit the Etsy listing to get the real page title
      await page.goto(etsyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const pageTitle = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1?.textContent?.trim() || '';
      });

      const pinDesc = shortTitle(pageTitle || listing.title);
      console.log(`  Pin title: "${pinDesc}"`);

      // Navigate to Pinterest's pin create page
      const pinSaveUrl = `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(etsyUrl)}&description=${encodeURIComponent(pinDesc)}`;
      await page.goto(pinSaveUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Check if Pinterest login is required
      const pinUrl = page.url();
      if (pinUrl.includes('login') || pinUrl.includes('signin')) {
        console.log('  Please log in to Pinterest! Waiting 120 seconds...');
        for (let t = 0; t < 120; t++) {
          await new Promise(r => setTimeout(r, 1000));
          const u = page.url();
          if (u.includes('pin/create')) break;
        }
        await page.waitForTimeout(2000);
      }

      await page.waitForTimeout(1000);

      // Find and click the red "Save" button
      const savePos = await page.evaluate(() => {
        const els = document.querySelectorAll('div, button, span, a');
        for (const el of els) {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundColor;
          const rect = el.getBoundingClientRect();
          if (bg === 'rgb(230, 0, 35)' && rect.width > 30 && rect.width < 200 && rect.height > 20 && rect.height < 60) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          }
        }
        return null;
      });

      if (!savePos) {
        console.log('  Save button not found');
        continue;
      }

      await page.mouse.click(savePos.x, savePos.y);

      // Wait for confirmation
      let confirmed = false;
      for (let wait = 0; wait < 20; wait++) {
        await page.waitForTimeout(1000);
        confirmed = await page.evaluate(() => {
          const text = document.body?.innerText || '';
          return text.includes('Saved to') || text.includes('saved to') ||
                 text.includes('kaydedildi') || text.includes('kaydettiniz');
        });
        if (confirmed) break;
      }

      if (confirmed) {
        console.log('  Saved to Pinterest!');
        progress.pinned.push({
          id: listing.id,
          title: listing.title,
          pinTitle: pinDesc,
          pinnedAt: new Date().toISOString()
        });
        progress.lastUpdated = new Date().toISOString();
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      } else {
        console.log('  No confirmation received');
      }

      // Random delay between pins (15-30 seconds)
      const delay = 15000 + Math.random() * 15000;
      console.log(`  Waiting ${Math.round(delay / 1000)}s...`);
      await new Promise(r => setTimeout(r, delay));

    } catch (err) {
      console.log(`  Error: ${err.message?.substring(0, 80)}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n=========================================');
  console.log(`Pinterest: ${progress.pinned.length}/${listings.length} pinned`);
  console.log('=========================================\n');

  await browser.close();
})();
